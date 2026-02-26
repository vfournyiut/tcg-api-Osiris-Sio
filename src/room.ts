import { Server, Socket } from 'socket.io'

import { prisma } from './database'

/**
 * Interface représentant une salle (room) de matchmaking.
 *
 * @typedef {Object} Room
 * @property {string} id - Identifiant unique de la salle.
 * @property {Object} host - Informations sur le créateur de la salle.
 * @property {Object} [opponent] - Informations sur l'adversaire (si présent).
 * @property {'waiting' | 'playing'} status - État actuel de la salle.
 */
interface Room {
  id: string
  host: {
    userId: number
    username: string
    socketId: string
    deckId: number
  }
  opponent?: {
    userId: number
    username: string
    socketId: string
    deckId: number
  }
  status: 'waiting' | 'playing'
}

// Stockage des rooms en mémoire pour le matchmaking
const rooms: Map<string, Room> = new Map()
let roomIdCounter = 1

/**
 * Broadcast de la liste des rooms en attente à tout le monde.
 *
 * @param {Server} io - L'instance du serveur Socket.io.
 * @returns {void}
 */
function broadcastRoomsList(io: Server) {
  const availableRooms = Array.from(rooms.values()).filter(
    (r) => r.status === 'waiting',
  )
  io.emit('roomsListUpdated', availableRooms)
}

/**
 * Gère les événements Socket.io liés au matchmaking (rooms).
 *
 * @param {Server} io - L'instance du serveur Socket.io.
 * @param {Socket} socket - Le socket du client connecté.
 * @returns {void}
 */
export function handleRoomEvents(io: Server, socket: Socket) {
  /**
   * Événement : Créer une room d'attente avec un deck.
   * Le joueur devient le host et attend un second joueur.
   *
   * @param {Object} data - Les données de la room.
   * @param {string} data.deckId - L'ID du deck à utiliser.
   * @emits roomCreated - En cas de succès.
   * @emits roomsListUpdated - Broadcast de la nouvelle liste.
   * @emits error - En cas de deck invalide ou erreur serveur.
   */
  socket.on('createRoom', async (data: { deckId: string }) => {
    try {
      // On s'assure que l'utilisateur est authentifié
      const userId = socket.user?.userId
      if (!userId) {
        socket.emit('error', {
          message: 'Vous devez être connecté pour créer une room.',
        })
        return
      }

      const deckId = parseInt(data.deckId.toString())

      // On vérifie que le deck appartient à l'utilisateur et contient 10 cartes
      const deck = await prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          _count: { select: { deckCard: true } },
        },
      })

      // Erreur si le deck n'appartient pas à l'utilisateur ou n'existe pas
      if (!deck || deck.userId !== userId) {
        socket.emit('error', {
          message: "Ce deck ne vous appartient pas ou n'existe pas.",
        })
        return
      }

      // Erreur si le deck est invalide (doit avoir exactement 10 cartes)
      if (deck._count.deckCard !== 10) {
        socket.emit('error', {
          message: 'Le deck doit contenir exactement 10 cartes.',
        })
        return
      }

      // Récupération des infos de l'utilisateur pour l'affichage de la room
      const user = await prisma.user.findUnique({ where: { id: userId } })
      // Erreur si l'utilisateur n'existe pas
      if (!user) {
        socket.emit('error', { message: 'Utilisateur non trouvé.' })
        return
      }
      const username = user.username

      // Création de l'objet Room
      const roomId = (roomIdCounter++).toString()
      const room: Room = {
        id: roomId,
        host: {
          userId,
          username,
          socketId: socket.id,
          deckId,
        },
        status: 'waiting',
      }

      // Stockage et mise en place du socket dans la room Socket.io
      rooms.set(roomId, room)
      socket.join(roomId)

      // Émission de roomCreated au créateur
      socket.emit('roomCreated', room)

      // Broadcast de la liste mise à jour à tout le monde (pour rafraîchir la liste des rooms)
      broadcastRoomsList(io)
    } catch (error) {
      // Gestion des erreurs serveur
      console.error('Erreur createRoom:', error)
      socket.emit('error', {
        message: 'Erreur lors de la création de la room.',
      })
    }
  })

  /**
   * Événement : Obtenir la liste des rooms disponibles (en attente).
   *
   * @emits roomsListUpdated - Envoie la liste des rooms disponibles au demandeur.
   */
  socket.on('getRooms', () => {
    // On ne renvoie que les rooms qui attendent un second joueur
    const availableRooms = Array.from(rooms.values()).filter(
      (r) => r.status === 'waiting',
    )
    socket.emit('roomsListUpdated', availableRooms)
  })

  /**
   * Événement : Rejoindre une room existante et démarrer la partie.
   *
   * @param {Object} data - Les données de jonction.
   * @param {string} data.roomId - L'ID de la room à rejoindre.
   * @param {string} data.deckId - L'ID du deck de l'opposant.
   * @emits gameStarted - Envoyé aux deux joueurs quand la partie commence.
   * @emits roomsListUpdated - Broadcast de la liste mise à jour.
   * @emits error - Si la room est pleine, inexistante ou si le deck est invalide.
   */
  socket.on('joinRoom', async (data: { roomId: string; deckId: string }) => {
    try {
      const userId = socket.user?.userId
      if (!userId) {
        socket.emit('error', {
          message: 'Vous devez être connecté pour rejoindre une room.',
        })
        return
      }

      const roomId = data.roomId.toString()
      const deckId = parseInt(data.deckId.toString())

      const room = rooms.get(roomId)

      // Vérifications de base sur la room
      if (!room) {
        socket.emit('error', { message: "La room n'existe pas." })
        return
      }

      if (room.status !== 'waiting') {
        socket.emit('error', { message: 'La room est déjà complète.' })
        return
      }

      if (room.host.userId === userId) {
        socket.emit('error', {
          message: 'Impossible de rejoindre votre propre room.',
        })
        return
      }

      // Vérification du deck du joueur qui rejoint
      const deck = await prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          _count: { select: { deckCard: true } },
        },
      })

      if (!deck || deck.userId !== userId) {
        socket.emit('error', {
          message: "Ce deck ne vous appartient pas ou n'existe pas.",
        })
        return
      }

      if (deck._count.deckCard !== 10) {
        socket.emit('error', {
          message: 'Le deck doit contenir exactement 10 cartes.',
        })
        return
      }

      // Récupération des infos de l'opposant
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        socket.emit('error', { message: 'Utilisateur non trouvé.' })
        return
      }
      const username = user.username

      // On complète la room et on change son statut
      room.opponent = {
        userId,
        username,
        socketId: socket.id,
        deckId,
      }
      room.status = 'playing'
      socket.join(roomId)

      // On récupère les cartes des deux decks pour l'état initial
      const hostDeckCards = await getDeckCards(room.host.deckId)
      const opponentDeckCards = await getDeckCards(deckId)

      // Démarrage de la partie : envoi de gameStarted aux deux joueurs
      // Le Host reçoit sa main visible et celle de l'adversaire cachée
      io.to(room.host.socketId).emit('gameStarted', {
        roomId: room.id,
        you: {
          // host
          username: room.host.username,
          hand: hostDeckCards,
        },
        opponent: {
          username: room.opponent!.username,
          handSize: opponentDeckCards.length,
        },
      })

      // L'opposant reçoit sa main visible et celle de l'hôte cachée
      io.to(room.opponent.socketId).emit('gameStarted', {
        roomId: room.id,
        you: {
          // opponent
          username: room.opponent!.username,
          hand: opponentDeckCards,
        },
        opponent: {
          // host
          username: room.host.username,
          handSize: hostDeckCards.length,
        },
      })

      // La room disparaît de la liste des rooms disponibles
      broadcastRoomsList(io)
    } catch (error) {
      console.error('Erreur joinRoom:', error)
      socket.emit('error', { message: 'Erreur lors de la jonction à la room.' })
    }
  })

  /**
   * Gestion de la déconnexion : si un host part avant le début, on supprime la room.
   */
  socket.on('disconnect', () => {
    for (const [id, room] of rooms.entries()) {
      if (room.host.socketId === socket.id && room.status === 'waiting') {
        rooms.delete(id)
        broadcastRoomsList(io)
        break
      }
    }
  })
}

/**
 * Utilitaire pour récupérer toutes les cartes d'un deck donné.
 *
 * @param {number} deckId - L'identifiant du deck.
 * @returns {Promise<Card[]>} - La liste des cartes du deck.
 * @throws {Error} Erreur lors de la récupération en base de données.
 */
async function getDeckCards(deckId: number) {
  const deckCards = await prisma.deckCard.findMany({
    where: { deckId },
    include: { card: true },
  })
  return deckCards.map((dc) => dc.card)
}
