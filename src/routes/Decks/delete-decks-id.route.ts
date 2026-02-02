import { type Request, type Response, Router } from 'express';
import { prisma } from '../../database';
import { authenticateToken } from '../../auth.middleware';

export const deleteDecksIdRouter = Router();

// delete /api/decks/:id
//Modifier le nom et/ou les cartes du deck de l'utilisateur authentifié.
deleteDecksIdRouter.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Récupération de l'userId du token (sinon erreur 401) :
      if (!req.user) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }
      const userId = req.user.userId;

      // Récupération de l'id du deck depuis les paramètres de l'URL :
      const deckId = req.params.id;

      // Si aucun id n'est passé en paramètre de l'URL, erreur 400 :
      if (!req.params.id || !Number.isInteger(parseInt(deckId))) {
        return res.status(400).json({ error: 'ID du deck manquant' });
      }

      // Vérifier si l'id correspond à un deck :
      const idWithDeck = await prisma.deck.findUnique({
        where: { id: parseInt(deckId) }
      });

      // Si l'id correspond à aucun deck, erreur 404 :
      if (!idWithDeck) {
        return res.status(404).json({ error: 'ID du deck inexistant' });
      }

      // Récupération du deck de l'utilisateur d'Id "deckId":
      const deckIdUser = await prisma.deck.findUnique({
        where: { id: parseInt(deckId), userId },
        include: {
          deckCard: {
            include: {
              card: true // On 'descend' dans la relation pour avoir les données des cartes
            }
          }
        }
      });

      // Si le deck n'existe pas :
      if (!deckIdUser) {
        return res
          .status(403)
          .json({ error: 'Deck non trouvé pour cet utilisateur' });
      } else {
        // Sinon, supprime le deck, ainsi que les relations DeckCard :
        await prisma.deckCard.deleteMany({
          where: { deckId: parseInt(deckId) }
        });
        await prisma.deck.delete({
          where: { id: parseInt(deckId), userId }
        });
        return res.status(200).json({
          message: `Le deck '${deckIdUser.name}' de l'utilisateur n°${userId} a été supprimé avec succès.`
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des decks : ', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);
