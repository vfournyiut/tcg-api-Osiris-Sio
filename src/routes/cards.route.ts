import { type Request, type Response, Router } from 'express';
import { prisma } from '../database';

export const cardsRouter = Router();

// GET /api/cards
// Récupère la liste complète des cartes.
cardsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Récupérer toutes les cartes, triées par numéro de Pokédex.
    const cards = await prisma.card.findMany({
      orderBy: { pokedexNumber: 'asc' }
    });

    // Retourner les cartes :
    return res.status(200).json(cards);
  } catch (error) {
    console.error('Erreur lors de la récupération des cartes : ', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
