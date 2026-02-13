import { type Request, type Response, Router } from 'express'
import { prisma } from '../../database'
import { authenticateToken } from '../../auth.middleware'

export const getDecksIdRouter = Router()

// GET /api/decks/:id
// Lister un deck de l'utilisateur authentifié avec leurs cartes.
/**
 * Route pour récupérer un deck spécifique par son ID.
 * Retourne le deck et ses cartes si l'utilisateur est autorisé.
 *
 * @name GET /api/decks/:id
 * @function
 * @memberof module:routes/decks
 * @param {Request} req - La requête Express avec l'ID du deck en paramètre.
 * @param {Response} res - La réponse Express.
 * @returns {Promise<Response>} - Une réponse JSON contenant les détails du deck.
 * @throws {400} ID du deck manquant ou invalide.
 * @throws {401} Utilisateur non authentifié.
 * @throws {403} Deck non trouvé pour cet utilisateur (accès refusé).
 * @throws {404} Deck inexistant.
 * @throws {500} Erreur serveur.
 */
getDecksIdRouter.get(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Récupération de l'userId du token (sinon erreur 401) :
      if (!req.user) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' })
      }
      const userId = req.user.userId

      // Récupération de l'id du deck depuis les paramètres de l'URL :
      const deckId = req.params.id

      // Si aucun id n'est passé en paramètre de l'URL, erreur 400 :
      if (!req.params.id || !Number.isInteger(parseInt(deckId))) {
        return res.status(400).json({ error: 'ID du deck manquant' })
      }

      // Vérifier si l'id correspond à un deck :
      const idWithDeck = await prisma.deck.findUnique({
        where: { id: parseInt(deckId) },
      })

      // Si l'id correspond à aucun deck, erreur 404 :
      if (!idWithDeck) {
        return res.status(404).json({ error: 'ID du deck inexistant' })
      }

      // Récupération du deck de l'utilisateur d'Id "deckId":
      const deckIdUser = await prisma.deck.findUnique({
        where: { id: parseInt(deckId), userId },
        include: {
          deckCard: {
            include: {
              card: true, // On 'descend' dans la relation pour avoir les données des cartes
            },
          },
        },
      })

      // Si le deck n'existe pas :
      if (!deckIdUser) {
        return res
          .status(403)
          .json({ error: 'Deck non trouvé pour cet utilisateur' })
      } else {
        // Retourne les decks si tout est bon !
        return res.status(200).json({
          message: `Decks de l'utilisateur n°${userId}`,
          deck: deckIdUser && {
            deckId: deckIdUser.id,
            deckName: deckIdUser.name,
            cards: deckIdUser.deckCard.map((deckCard) => ({
              // Cartes
              id: deckCard.card.id,
              name: deckCard.card.name,
              pokedexNumber: deckCard.card.pokedexNumber,
              imageUrl: deckCard.card.imgUrl,
            })),
          },
        })
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des decks : ', error)
      return res.status(500).json({ error: 'Erreur serveur' })
    }
  },
)
