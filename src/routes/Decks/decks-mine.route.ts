import { type Request, type Response, Router } from 'express'
import { prisma } from '../../database'
import { authenticateToken } from '../../auth.middleware'

export const decksMineRouter = Router()

// GET /api/decks/mine
// Lister tous les decks de l'utilisateur authentifié avec leurs cartes.
/**
 * Route pour récupérer les decks de l'utilisateur connecté.
 * Retourne la liste des decks avec les détails des cartes associées.
 *
 * @name GET /api/decks/mine
 * @function
 * @memberof module:routes/decks
 * @param {Request} req - La requête Express (nécessite authentification).
 * @param {Response} res - La réponse Express.
 * @returns {Promise<Response>} - Une réponse JSON contenant les decks de l'utilisateur.
 * @throws {401} Utilisateur non authentifié.
 * @throws {500} Erreur serveur.
 */
decksMineRouter.get(
  '/mine',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Récupération de l'userId du token (sinon erreur 401) :
      if (!req.user) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' })
      }
      const userId = req.user.userId

      // Récupération des decks de l'utilisateur :
      const decksUser = await prisma.deck.findMany({
        where: { userId },
        include: {
          deckCard: {
            include: {
              card: true, // On 'descend' dans la relation pour avoir les données des cartes
            },
          },
        },
      })

      // Retourne les decks si tout est bon !
      return res.status(200).json({
        message: `Decks de l'utilisateur n°${userId}`,
        decks: decksUser.map((deck) => ({
          deckId: deck.id,
          deckName: deck.name,
          cards: deck.deckCard.map((deckCard) => ({
            // Cartes
            id: deckCard.card.id,
            name: deckCard.card.name,
            pokedexNumber: deckCard.card.pokedexNumber,
            imageUrl: deckCard.card.imgUrl,
          })),
        })),
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des decks : ', error)
      return res.status(500).json({ error: 'Erreur serveur' })
    }
  },
)
