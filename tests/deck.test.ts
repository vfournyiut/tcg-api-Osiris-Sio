import { describe, expect, it, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { prismaMock, authMock } from './vitest.setup.js';
import { app } from '../src/index.js';
import { PokemonType } from '../src/generated/prisma/enums';

// Sommaire (respect de la consigne : tous les tests de Deck dans ce fichier 'deck.test.ts') :
// Ligne 14 :  Decks API - Mine
// Ligne 93 :  Decks API - Create
// Ligne 228 : Decks API - Delete ID
// Ligne 327 : Decks API - Get ID
// Ligne 439 : Decks API - Patch ID

describe('Decks API - Mine', () => {
  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test.
  beforeEach(() => {
    vi.resetModules();
  });

  // === Consultation Réussie (200) :
  describe('GET /api/decks/mine', () => {
    it('should return all decks for the authenticated user', async () => {
      const mockDecks = [
        {
          id: 1,
          name: 'My First Deck',
          userId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deckCard: [
            {
              id: 101, // id de la relation DeckCard
              deckId: 1,
              cardId: 1,
              card: {
                id: 1,
                name: 'Bulbasaur',
                hp: 45,
                attack: 49,
                type: PokemonType.Grass,
                pokedexNumber: 1,
                imgUrl: 'url1',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            }
          ]
        }
      ];
      prismaMock.deck.findMany.mockResolvedValue(mockDecks);

      const response = await request(app).get('/api/decks/mine');

      // Vérification :
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Decks de l'utilisateur n°1");
      expect(response.body.decks).toHaveLength(1);
      expect(response.body.decks[0].cards[0].name).toBe('Bulbasaur');
    });

    // === Consultation Échouée : Erreur serveur (500) :
    it('should return 500 if there is a server error', async () => {
      prismaMock.deck.findMany.mockRejectedValue(new Error('Server error'));

      const response = await request(app).get('/api/decks/mine');

      // Vérification :
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Erreur serveur');
    });

    // === Consultation Échouée : Utilisateur non authentifié (401) :
    it('should return 401 if user is not authenticated', async () => {
      // Simule une authentification échouée en ne définissant pas req.user :

      authMock.authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app).get('/api/decks/mine');

      // Vérification :
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        'error',
        'Utilisateur non authentifié'
      );
    });
  });
});

describe('Decks API - Create', () => {
  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test.
  beforeEach(() => {
    vi.resetModules();
  });

  // === Création Réussie (200) :
  it('should create a new deck for the authenticated user', async () => {
    const newDeckData = {
      name: 'My New Deck',
      cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    };

    // Mock de la vérification des cartes :
    prismaMock.card.findFirst.mockResolvedValue({
      id: 1,
      name: 'Test Card',
      hp: 50,
      attack: 50,
      type: PokemonType.Grass,
      pokedexNumber: 1,
      imgUrl: 'url',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Mock de la création du deck
    prismaMock.deck.create.mockResolvedValue({
      id: 1,
      name: newDeckData.name,
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app).post('/api/decks').send(newDeckData);

    // Vérification :
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Deck validé avec succès');
    expect(response.body.deck.name).toBe(newDeckData.name);
  });

  // === Création Échouée : Données manquantes/invalides (400) :
  it('should return 400 if name or cards are missing/invalid', async () => {
    const response = await request(app)
      .post('/api/decks')
      .send({
        name: 'Incomplete Deck',
        cards: [1, 2] // Seulement 2 cartes au lieu des 10 demandées
      });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Données manquantes/invalides');
  });

  // === Création Échouée : Numéro de carte invalide (400) :
  it('should return 400 if a card ID is not a number', async () => {
    const response = await request(app)
      .post('/api/decks')
      .send({
        name: 'Invalid Cards',
        cards: ['1', 2, 3, 4, 5, 6, 7, 8, 9, 10] // Le premier ID de carte n'est pas valide
      });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toContain(
      "n'est pas un numéro de carte valide"
    );
  });

  // === Création Échouée : Carte n'existe pas (400) :
  it("should return 400 if a card doesn't exist in database", async () => {
    prismaMock.card.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/decks')
      .send({
        name: 'Deck with Nonexistent Card',
        cards: [999, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("n'existe pas");
  });

  // === Création Échouée : Erreur serveur (500) :
  it('should return 500 if there is a server error during creation', async () => {
    // Mock de la vérification des cartes :
    prismaMock.card.findFirst.mockResolvedValue({
      id: 1,
      name: 'Test Card',
      hp: 50,
      attack: 50,
      type: PokemonType.Grass,
      pokedexNumber: 1,
      imgUrl: 'url',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prismaMock.deck.create.mockRejectedValue(new Error('Server error'));

    const response = await request(app)
      .post('/api/decks')
      .send({
        name: 'Error Deck',
        cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      });

    // Vérification :
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error', 'Erreur serveur');
  });

  // === Création Échouée : Utilisateur non authentifié (401):
  it('should return 401 if user is not authenticated during creation', async () => {
    // Simule une authentification échouée en ne définissant pas req.user :
    authMock.authenticateToken.mockImplementationOnce((req, res, next) => {
      req.user = undefined;
      next();
    });

    const response = await request(app)
      .post('/api/decks')
      .send({
        name: 'Unauthorized Deck',
        cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      });
  });
});

describe('Decks API - Delete ID', () => {
  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test.
  beforeEach(() => {
    vi.resetModules();
  });

  // === Suppression Réussie (200) :
  it('should delete a deck for the authenticated user', async () => {
    const mockDeck = {
      id: 1,
      name: 'Deck to Delete',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock de la vérification de l'existence du deck :
    prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck);

    // Mock de la vérification de propriété (userId) :
    prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck);

    const response = await request(app).delete('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('supprimé avec succès');
    expect(prismaMock.deck.delete).toHaveBeenCalled();
  });

  // === Suppression Échouée : ID du deck manquant (400) :
  it('should return 400 if deck ID is invalid', async () => {
    const response = await request(app).delete('/api/decks/abc');

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ID du deck manquant');
  });

  // === Suppression Échouée : ID du deck inexistant (404) :
  it('should return 404 if deck does not exist', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null);

    const response = await request(app).delete('/api/decks/999');

    // Vérification :
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('ID du deck inexistant');
  });

  // === Suppression Échouée : Deck non trouvé pour cet utilisateur (403) :
  it('should return 403 if deck does not belong to user', async () => {
    // Mock de l'existence globale du deck :
    prismaMock.deck.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Other User Deck',
      userId: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    // Mais pas pour cet utilisateur :
    prismaMock.deck.findUnique.mockResolvedValueOnce(null);

    const response = await request(app).delete('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Deck non trouvé pour cet utilisateur');
  });

  // === Suppression Échouée : Erreur serveur (500) :
  it('should return 500 if there is a server error during deletion', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Server error'));

    const response = await request(app).delete('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error', 'Erreur serveur');
  });

  // === Suppression Échouée : Utilisateur non authentifié (401) :
  it('should return 401 if user is not authenticated during deletion', async () => {
    authMock.authenticateToken.mockImplementationOnce((req, res, next) => {
      req.user = undefined;
      next();
    });

    const response = await request(app).delete('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty(
      'error',
      'Utilisateur non authentifié'
    );
  });
});

describe('Decks API - Get ID', () => {
  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test.
  beforeEach(() => {
    vi.resetModules();
  });

  // === Consultation Réussie (200) :

  it('should return a specific deck for the authenticated user', async () => {
    const mockDeck = {
      id: 1,
      name: 'My Specific Deck',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deckCard: [
        {
          card: {
            id: 1,
            name: 'Bulbasaur',
            pokedexNumber: 1,
            imgUrl: 'url1'
          }
        }
      ]
    };

    // Mock de la vérification de l'existence du deck :
    prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck);

    // Mock de la récupération avec inclusion des cartes :
    prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck);

    const response = await request(app).get('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Decks de l'utilisateur n°1");
    expect(response.body.deck.deckName).toBe('My Specific Deck');
    expect(response.body.deck.cards).toHaveLength(1);
  });

  // === Consultation Échouée : ID du deck manquant (400) :
  it('should return 400 if deck ID is invalid', async () => {
    const response = await request(app).get('/api/decks/invalid-id');

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ID du deck manquant');
  });

  // === Consultation Échouée : ID du deck inexistant (404) :
  it('should return 404 if deck does not exist', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null);

    const response = await request(app).get('/api/decks/999');

    // Vérification :
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('ID du deck inexistant');
  });

  // === Consultation Échouée : Deck non trouvé pour cet utilisateur (403) :

  it('should return 403 if deck does not belong to user', async () => {
    // Mock de l'existence globale du deck :
    prismaMock.deck.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Other User Deck',
      userId: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    // Mais pas pour cet utilisateur :
    prismaMock.deck.findUnique.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Deck non trouvé pour cet utilisateur');
  });

  // === Consultation Échouée : Erreur Serveur (500) :
  it('should return 500 if there is a server error during retrieval', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Server error'));

    const response = await request(app).get('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error', 'Erreur serveur');
  });

  // === Consultation Échouée : Utilisateur non authentifié (401) :
  it('should return 401 if user is not authenticated during retrieval', async () => {
    authMock.authenticateToken.mockImplementationOnce((req, res, next) => {
      req.user = undefined;
      next();
    });

    const response = await request(app).get('/api/decks/1');

    // Vérification :
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty(
      'error',
      'Utilisateur non authentifié'
    );
  });
});

describe('Decks API - Patch ID', () => {
  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test.
  beforeEach(() => {
    vi.resetModules();
  });

  // === Modification Réussie (200) :
  it('should update a deck name and cards for the authenticated user', async () => {
    const mockDeck = {
      id: 1,
      name: 'Old Name',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deckCard: []
    };

    // Mock de l'existence du deck :
    prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck);

    // Mock de la vérification de propriété :
    prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck);

    // Mock de la vérification des cartes :
    prismaMock.card.findFirst.mockResolvedValue({
      id: 10,
      pokedexNumber: 10,
      name: 'Test Card'
    } as any);

    const response = await request(app)
      .patch('/api/decks/1')
      .send({
        name: 'New Name',
        cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      });

    // Vérification :
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('effectuée avec succès');
    expect(prismaMock.deck.update).toHaveBeenCalled();
  });

  // === Modification Réussie (aucune modication effectuée) (200) :
  it('should return 200 even if no data is provided for update', async () => {
    const mockDeck = {
      id: 1,
      name: 'Same Name',
      userId: 1
    };
    prismaMock.deck.findUnique.mockResolvedValue(mockDeck as any);

    const response = await request(app).patch('/api/decks/1').send({});

    // Vérification :
    expect(response.status).toBe(200);
    expect(response.body.message).toContain(
      "Aucune modification n'a été effectuée"
    );
  });

  // === Modification Échouée : ID du deck manquant (400) :
  it('should return 400 if deck ID is not an integer', async () => {
    const response = await request(app)
      .patch('/api/decks/invalid-id')
      .send({ name: 'New Name' });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ID du deck manquant');
  });

  // === Modification Échouée : ID du deck inexistant (404) :
  it('should return 404 if deck does not exist', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/decks/999')
      .send({ name: 'New Name' });

    // Vérification :
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('ID du deck inexistant');
  });

  // === Modification Échouée : Données invalides (400) :
  it('should return 400 if name or cards format is invalid', async () => {
    const mockDeck = {
      id: 1,
      name: 'Old Name',
      userId: 1
    };
    prismaMock.deck.findUnique.mockResolvedValue(mockDeck as any);

    const response = await request(app)
      .patch('/api/decks/1')
      .send({
        name: 123, // Devrait être une string
        cards: [1, 2] // Devrait avoir 10 ID de cartes
      });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Données invalides');
  });

  // === Modification Échouée : Numéro de carte invalide (400) :
  it('should return 400 if a card in the array is not a number', async () => {
    const mockDeck = { id: 1, name: 'Old Name', userId: 1 };
    prismaMock.deck.findUnique.mockResolvedValue(mockDeck as any);

    const response = await request(app)
      .patch('/api/decks/1')
      .send({
        cards: ['1', 2, 3, 4, 5, 6, 7, 8, 9, 10] // Le premier ID de carte n'est pas valide
      });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toContain(
      "n'est pas un numéro de carte valide"
    );
  });

  // === Modification Échouée : Carte n'existe pas (400) :
  it("should return 400 if one of the cards doesn't exist", async () => {
    const mockDeck = { id: 1, name: 'Old Name', userId: 1 };
    prismaMock.deck.findUnique.mockResolvedValue(mockDeck as any);
    prismaMock.card.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/decks/1')
      .send({
        cards: [999, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      });

    // Vérification :
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("n'existe pas");
  });

  // === Modification Échouée : Deck non trouvé pour cet utilisateur (403) :

  it('should return 403 if deck does not belong to user', async () => {
    prismaMock.deck.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 2,
      name: 'Other User Deck',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    prismaMock.deck.findUnique.mockResolvedValueOnce(null);

    const response = await request(app)
      .patch('/api/decks/1')
      .send({ name: 'New Name' });

    // Vérification :
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Deck non trouvé pour cet utilisateur');
  });

  // === Modification Échouée : Erreur serveur (500) :

  it('should return 500 if there is a server error during update', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Server error'));

    const response = await request(app)
      .patch('/api/decks/1')
      .send({ name: 'New Name' });

    // Vérification :
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error', 'Erreur serveur');
  });

  // === Modification Échouée : Utilisateur non authentifié (401) :

  it('should return 401 if user is not authenticated during update', async () => {
    authMock.authenticateToken.mockImplementationOnce((req, res, next) => {
      req.user = undefined;
      next();
    });

    const response = await request(app)
      .patch('/api/decks/1')
      .send({ name: 'New Name' });

    // Vérification :
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty(
      'error',
      'Utilisateur non authentifié'
    );
  });
});
