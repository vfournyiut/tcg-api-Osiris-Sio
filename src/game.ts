import { Server, Socket } from 'socket.io'

import { Card } from './generated/prisma/client'
import { Room, rooms } from './room'
import { calculateDamage } from './utils/rules.util'

// Interface étendue pour les cartes sur le terrain afin de suivre leurs PV actuels
interface GameCard extends Card {
  currentHP: number
}

// État d'un joueur dans la partie
interface PlayerState {
  socketId: string
  username: string
  deck: Card[] // Pioche (Face cachée, mélange simplifié : ordre de la DB)
  hand: Card[] // Main (Max 5, visible seulement par le joueur)
  activeCard: GameCard | null // Carte active sur le terrain (Max 1)
  score: number // Points de victoire (cartes adverses KO)
}

// État global de la partie
interface GameState {
  roomId: string
  players: {
    [socketId: string]: PlayerState
  }
  currentPlayerSocketId: string // SocketId du joueur dont c'est le tour
}

// Map pour stocker les parties en cours par roomId
const games: Map<string, GameState> = new Map()

/**
 * Recherche une partie en cours à partir de l'ID de socket d'un joueur.
 *
 * @param {string} socketId - L'ID du socket.
 * @returns {GameState | undefined} - La partie trouvée ou undefined.
 */
function findGameBySocketId(socketId: string): GameState | undefined {
  for (const game of games.values()) {
    if (game.players[socketId]) return game
  }
  return undefined
}

/**
 * Diffuse l'état du jeu mis à jour à tous les participants d'une partie.
 *
 * @param {Server} io - L'instance du serveur Socket.io.
 * @param {GameState} game - La partie concernée.
 * @returns {void}
 */
function broadcastGameState(io: Server, game: GameState) {
  for (const socketId in game.players) {
    io.to(socketId).emit(
      'gameStateUpdated',
      getSanitizedGameState(game, socketId),
    )
  }
}

/**
 * Filtre l'état du jeu pour un joueur spécifique (cache les données sensibles).
 *
 * @param {GameState} gameState - L'état complet du jeu.
 * @param {string} socketId - L'ID du socket du joueur demandeur.
 * @returns {Object} - L'état filtré.
 */
function getSanitizedGameState(gameState: GameState, socketId: string) {
  const playersIds = Object.keys(gameState.players)
  const me = gameState.players[socketId]
  const opponentId = playersIds.find((id) => id !== socketId)!
  const opponent = gameState.players[opponentId]

  return {
    roomId: gameState.roomId,
    currentPlayerSocketId: gameState.currentPlayerSocketId,
    you: {
      username: me.username,
      hand: me.hand,
      activeCard: me.activeCard,
      score: me.score,
      deckSize: me.deck.length,
    },
    opponent: {
      username: opponent.username,
      handSize: opponent.hand.length,
      activeCard: opponent.activeCard,
      score: opponent.score,
      deckSize: opponent.deck.length,
    },
  }
}

/**
 * Démarre une nouvelle partie.
 * Appelé depuis room.ts quand deux joueurs sont réunis.
 *
 * @param {Server} io - L'instance du serveur Socket.io.
 * @param {Room} room - La salle contenant les joueurs.
 * @param {Card[]} hostDeck - Les cartes du deck de l'hôte.
 * @param {Card[]} opponentDeck - Les cartes du deck de l'adversaire.
 * @returns {void}
 */
export function startGame(
  io: Server,
  room: Room,
  hostDeck: Card[],
  opponentDeck: Card[],
) {
  const gameState: GameState = {
    roomId: room.id,
    players: {
      [room.host.socketId]: {
        socketId: room.host.socketId,
        username: room.host.username,
        deck: hostDeck,
        hand: [],
        activeCard: null,
        score: 0,
      },
      [room.opponent!.socketId]: {
        socketId: room.opponent!.socketId,
        username: room.opponent!.username,
        deck: opponentDeck,
        hand: [],
        activeCard: null,
        score: 0,
      },
    },
    currentPlayerSocketId: room.host.socketId, // Le host commence toujours
  }

  games.set(room.id, gameState)

  // Envoi de l'événement initial gameStarted avec la vue adaptée à chaque joueur
  io.to(room.host.socketId).emit(
    'gameStarted',
    getSanitizedGameState(gameState, room.host.socketId),
  )
  io.to(room.opponent!.socketId).emit(
    'gameStarted',
    getSanitizedGameState(gameState, room.opponent!.socketId),
  )
}

/**
 * Gère les événements Socket.io liés à la logique de jeu.
 *
 * @param {Server} io - L'instance du serveur Socket.io.
 * @param {Socket} socket - Le socket du client connecté.
 * @returns {void}
 */
export function handleGameEvents(io: Server, socket: Socket) {
  /**
   * Événement : Piocher des cartes jusqu'à en avoir 5 en main.
   */
  socket.on('drawCards', () => {
    const game = findGameBySocketId(socket.id)
    if (!game) return // Si pas de partie, on ignore

    // Vérification du tour
    if (game.currentPlayerSocketId !== socket.id) {
      socket.emit('error', { message: "Ce n'est pas votre tour." })
      return
    }

    const player = game.players[socket.id]

    // Piocher jusqu'à 5 cartes tant qu'il en reste dans le deck
    while (player.hand.length < 5 && player.deck.length > 0) {
      const card = player.deck.shift() // shift() retire le premier élément du tableau et le retourne
      if (card) {
        // Si la carte existe
        player.hand.push(card) // Ajoute la carte à la main
      }
    }

    // Mise à jour de l'état pour les deux joueurs
    broadcastGameState(io, game)
  })

  /**
   * Événement : Jouer une carte de sa main sur le terrain.
   *
   * @param {Object} data - Les données de l'action.
   * @param {number} data.cardIndex - L'index de la carte dans la main.
   */
  socket.on('playCard', (data: { cardIndex: number }) => {
    const game = findGameBySocketId(socket.id)
    if (!game) return // Si pas de partie, on ignore

    if (game.currentPlayerSocketId !== socket.id) {
      socket.emit('error', { message: "Ce n'est pas votre tour." })
      return
    }

    const player = game.players[socket.id]

    // Vérification de l'index de carte
    if (
      data.cardIndex === undefined ||
      data.cardIndex < 0 ||
      data.cardIndex >= player.hand.length
    ) {
      socket.emit('error', {
        message: 'Indice de carte invalide. data.cardIndex: ' + data.cardIndex,
      })
      return
    }

    // Une seule carte active autorisée sur le terrain
    if (player.activeCard) {
      socket.emit('error', {
        message: 'Vous avez déjà une carte active sur le terrain.',
      })
      return
    }

    // La carte est retirée de la main et posée sur le terrain avec ses PV initiaux
    const card = player.hand.splice(data.cardIndex, 1)[0] // splice() retire le premier élément du tableau et le retourne
    player.activeCard = { ...card, currentHP: card.hp } // Ajoute la carte sur le terrain avec ses PV initiaux

    broadcastGameState(io, game)
  })

  /**
   * Événement : Attaquer la carte adverse avec sa carte active.
   */
  socket.on('attack', () => {
    const game = findGameBySocketId(socket.id)
    if (!game) return // Si pas de partie, on ignore

    if (game.currentPlayerSocketId !== socket.id) {
      socket.emit('error', { message: "Ce n'est pas votre tour." })
      return
    }

    // Récupération des joueurs
    const playerIds = Object.keys(game.players)
    const me = game.players[socket.id]
    const opponentId = playerIds.find((id) => id !== socket.id)!
    const opponent = game.players[opponentId]

    // Nécessite une carte active de chaque côté
    if (!me.activeCard) {
      socket.emit('error', {
        message: "Vous n'avez pas de carte active pour attaquer.",
      })
      return
    }

    if (!opponent.activeCard) {
      socket.emit('error', { message: "L'adversaire n'a pas de carte active." })
      return
    }

    // Calcul des dégâts via l'utilitaire de règles
    const damage = calculateDamage(
      me.activeCard.attack,
      me.activeCard.type,
      opponent.activeCard.type,
    )

    // Application des dégâts
    opponent.activeCard.currentHP -= damage

    // Gestion du KO si les HP tombent à 0 ou moins
    if (opponent.activeCard.currentHP <= 0) {
      opponent.activeCard = null
      me.score += 1
    }

    // Vérification de la condition de victoire (3 points)
    if (me.score >= 3) {
      io.to(game.roomId).emit('gameEnded', {
        winner: me.username,
        finalScores: {
          [me.username]: me.score,
          [opponent.username]: opponent.score,
        },
      })
      games.delete(game.roomId)
      rooms.delete(game.roomId) // Fermeture de la salle
      return
    }

    // Le tour change automatiquement après une attaque
    game.currentPlayerSocketId = opponentId

    // Notification au joueur adverse
    io.to(opponentId).emit('yourTurn', { message: "C'est votre tour !" })

    broadcastGameState(io, game)
  })

  /**
   * Événement : Terminer son tour manuellement.
   *
   * @param {Object} data - Les données de l'action.
   * @param {string} data.roomId - L'ID de la salle de jeu.
   */
  socket.on('endTurn', (data: { roomId: string }) => {
    const roomId = data.roomId?.toString()
    const game = games.get(roomId)

    if (!game) return // Si pas de partie, on ignore

    if (game.currentPlayerSocketId !== socket.id) {
      socket.emit('error', { message: "Ce n'est pas votre tour." })
      return
    }

    // On passe la main à l'autre joueur
    const playerIds = Object.keys(game.players)
    const opponentId = playerIds.find((id) => id !== socket.id)!

    game.currentPlayerSocketId = opponentId

    // Notification au joueur adverse
    io.to(opponentId).emit('yourTurn', { message: "C'est votre tour !" })

    broadcastGameState(io, game)
  })
}
