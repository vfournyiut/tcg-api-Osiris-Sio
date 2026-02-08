import { type Request, type Response, Router } from 'express'
import { prisma } from '../database'

export const cardsRouter = Router()

// GET /api/cards
/**
 * Route pour récupérer la liste complète des cartes.
 * Trie les cartes par numéro de Pokédex croissant.
 *
 * @name GET /api/cards
 * @function
 * @memberof module:routes/cards
 * @param {Request} _req - La requête Express (inutilisée).
 * @param {Response} res - La réponse Express.
 * @returns {Promise<Response>} - Une réponse JSON contenant la liste des cartes.
 * @throws {500} Erreur serveur.
 */
cardsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Récupérer toutes les cartes, triées par numéro de Pokédex.
    const cards = await prisma.card.findMany({
      orderBy: { pokedexNumber: 'asc' },
    })

    // Retourner les cartes :
    return res.status(200).json(cards)
  } catch (error) {
    console.error('Erreur lors de la récupération des cartes : ', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
})
