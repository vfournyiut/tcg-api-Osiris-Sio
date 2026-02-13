import { type Request, type Response, Router } from 'express'
import { prisma } from '../../database'
import { authenticateToken } from '../../auth.middleware'

export const decksRouter = Router()

// POST /api/decks
// Crée un nouveau deck pour l'utilisateur authentifié.
/**
 * Route pour créer un nouveau deck.
 * Vérifie la validité des cartes et associe le deck à l'utilisateur connecté.
 *
 * @name POST /api/decks
 * @function
 * @memberof module:routes/decks
 * @param {Request} req - La requête Express contenant name et cards (tableau d'IDs).
 * @param {Response} res - La réponse Express.
 * @returns {Promise<Response>} - Une réponse JSON contenant le deck créé.
 * @throws {400} Données manquantes ou invalides (nom, cartes) ou carte inexistante.
 * @throws {401} Utilisateur non authentifié.
 * @throws {500} Erreur serveur.
 *
 * @example
 * // Corps de la requête (req.body) :
 * {
 *   "name": "Mon Super Deck",
 *   "cards": [1, 5, 25, 4, 12, 6, 9, 2, 33, 10] // Exactement 10 IDs
 * }
 */
decksRouter.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { name, cards } = req.body

      // Récupération de l'userId du token (sinon erreur 401) :
      if (!req.user) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' })
      }
      const userId = req.user.userId

      // Si au moins l'une des données est manquante/invalide, alors erreur 400 (côté client) :
      if (
        !name ||
        typeof name !== 'string' ||
        !Array.isArray(cards) ||
        cards.length !== 10
      ) {
        return res.status(400).json({
          error:
            'Données manquantes/invalides. (name et cards sont requis. name est une chaîne de caractères et cards est un tableau de 10 numéros de carte)',
        })
      }

      // Vérification que chaque carte (ID) est bien dans la base de données :
      for (const pokedexNumber of cards) {
        // On vérifie d'abord si c'est bien un nombre :
        if (typeof pokedexNumber !== 'number') {
          return res.status(400).json({
            error: `La carte avec le numéro ${pokedexNumber} n'est pas un numéro de carte valide.`,
          })
        }

        // On vérifie si la carte existe en base de données :
        const card = await prisma.card.findFirst({
          where: { pokedexNumber: pokedexNumber },
        })

        // Si findFirst renvoie null, la carte n'existe pas :
        if (!card) {
          return res.status(400).json({
            error: `La carte avec le numéro ${pokedexNumber} n'existe pas.`,
          })
        }
      }

      // Création du deck :
      const newDeck = await prisma.deck.create({
        data: {
          name,
          user: {
            connect: { id: userId },
          },
          deckCard: {
            create: cards.map((cardId: number) => ({
              card: {
                connect: { id: cardId },
              },
            })),
          },
        },
      })

      // Si on sort de la boucle sans avoir d'erreur, c'est que tout est bon !
      return res.status(201).json({
        message: 'Deck validé avec succès',
        deck: newDeck,
      })
    } catch (error) {
      console.error('Erreur lors de la création du deck : ', error)
      return res.status(500).json({ error: 'Erreur serveur' })
    }
  },
)
