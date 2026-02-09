import { type Request, type Response, Router } from 'express';
import { prisma } from '../../database';
import { authenticateToken } from '../../auth.middleware';

export const patchDecksIdRouter = Router();

// patch /api/decks/:id
// Modifier le nom et/ou les cartes du deck de l'utilisateur authentifié.
/**
 * Route pour modifier un deck existant (nom et/ou cartes).
 *
 * @name PATCH /api/decks/:id
 * @function
 * @memberof module:routes/decks
 * @param {Request} req - La requête Express avec l'ID du deck en paramètre et les champs à modifier dans le body.
 * @param {Response} res - La réponse Express.
 * @returns {Promise<Response>} - Une réponse JSON confirmant la modification.
 * @throws {400} Données invalides (ID, nom, cartes) ou carte inexistante.
 * @throws {401} Utilisateur non authentifié.
 * @throws {403} Deck n'appartient pas à l'utilisateur.
 * @throws {404} Deck introuvable.
 * @throws {500} Erreur serveur.
 *
 * @example
 * // Corps de la requête (req.body) - Modification partielle :
 * {
 *   "name": "Nouveau Nom"
 * }
 *
 * @example
 * // Corps de la requête (req.body) - Modification complète :
 * {
 *   "name": "Nouveau Nom",
 *   "cards": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
 * }
 */
patchDecksIdRouter.patch(
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

      // Récupération de la modification du deck :
      const { name, cards } = req.body;

      // Si au moins l'une des données est manquante/invalide, alors erreur 400 (côté client) :
      if (
        (name && typeof name !== 'string') ||
        (cards && !Array.isArray(cards)) ||
        (cards && cards.length !== 10)
      ) {
        return res.status(400).json({
          error:
            'Données invalides. (name est une chaîne de caractères et cards est un tableau de 10 numéros de carte)'
        });
      }

      // Vérification que chaque carte (ID) est bien dans la base de données si et seulement si des cartes sont passé en payload :
      if (cards) {
        for (const pokedexNumber of cards) {
          // On vérifie d'abord si c'est bien un nombre :
          if (typeof pokedexNumber !== 'number') {
            return res.status(400).json({
              error: `La carte avec le numéro ${pokedexNumber} n'est pas un numéro de carte valide.`
            });
          }

          // On vérifie si la carte existe en base de données :
          const card = await prisma.card.findFirst({
            where: { pokedexNumber: pokedexNumber }
          });

          // Si findFirst renvoie null, la carte n'existe pas :
          if (!card) {
            return res.status(400).json({
              error: `La carte avec le numéro ${pokedexNumber} n'existe pas.`
            });
          }
        }
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
        let nameUpdate = false;
        let cardsUpdate = false;

        // Mise à jour du nom du deck si et seulement si un nom est passé en payload :
        if (name) {
          nameUpdate = true;
          await prisma.deck.update({
            where: { id: parseInt(deckId), userId },
            data: { name }
          });
        }

        // Mise à jour des cartes du deck si et seulement si des cartes sont passé en payload :
        if (cards) {
          cardsUpdate = true;
          await prisma.deck.update({
            where: { id: parseInt(deckId), userId },
            data: {
              deckCard: {
                deleteMany: {
                  // Supprime tout
                  deckId: parseInt(deckId)
                },
                create: cards.map((cardId: number) => ({
                  // Recrée tout
                  card: {
                    connect: { id: cardId }
                  }
                }))
              }
            }
          });
        }

        if (nameUpdate || cardsUpdate) {
          return res.status(200).json({
            message: `Modification du deck '${deckIdUser.name}' de l'utilisateur n°${userId} effectuée avec succès.`
          });
        } else {
          return res.status(200).json({
            message: `Aucune modification n'a été effectuée sur le deck '${deckIdUser.name}' de l'utilisateur n°${userId}.`
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des decks : ', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);
