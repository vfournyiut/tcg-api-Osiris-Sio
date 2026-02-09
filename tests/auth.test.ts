import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prismaMock } from './vitest.setup';
import { app } from '../src/index.js';

describe('Auth API', () => {
  // Sign Up :

  describe('POST /api/auth/sign-up', () => {
    // === Création Réussi (201):
    it('should create a new user and return a token', async () => {
      const newUser = {
        id: 1,
        username: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock de la création d'utilisateur pour simuler une inscription réussie :
      prismaMock.user.create.mockResolvedValue(newUser);

      // Envoie de la création :
      const response = await request(app).post('/api/auth/sign-up').send({
        username: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      // Vérifications :
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Inscription réussie');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      });
    });

    // === Création Échoué : Données manquantes/invalides (400):
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app).post('/api/auth/sign-up').send({
        username: 'Test User'
        // email et password manquant
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'Données manquantes/invalides. (username, email et password sont requis et doivent être des chaînes de caractères)'
      );
    });

    // === Création Échoué : Email invalide (400) :
    it('should return 400 if email is invalid', async () => {
      const response = await request(app).post('/api/auth/sign-up').send({
        username: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email invalide.');
    });

    // === Création Échoué : Email déjà utilisé (409) :
    it('should return 409 if email already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'Existing User',
        email: 'test@example.com',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app).post('/api/auth/sign-up').send({
        username: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Email déjà utilisé');
    });

    // === Création Échoué : Erreur serveur (500) :
    it('should return 500 if there is a server error', async () => {
      // Mock de la création d'utilisateur pour simuler une erreur serveur :
      prismaMock.user.create.mockRejectedValue(new Error('Server error'));

      const response = await request(app).post('/api/auth/sign-up').send({
        username: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Erreur serveur');
    });
  });

  // Sign In :

  describe('POST /api/auth/sign-in', () => {
    // === Connexion Réussie (200):
    it('should login an existing user and return a token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const existingUser = {
        id: 1,
        username: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock de la recherche d'utilisateur :
      prismaMock.user.findUnique.mockResolvedValue(existingUser);

      // Envoie de la connexion :
      const response = await request(app).post('/api/auth/sign-in').send({
        email: 'test@example.com',
        password: 'password123'
      });

      // Vérifications :
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Connexion réussie');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: existingUser.id,
        username: existingUser.username,
        email: existingUser.email
      });
    });

    // === Connexion Échouée : Données manquantes/invalides (400):
    it('should return 400 if email or password is missing', async () => {
      const response = await request(app).post('/api/auth/sign-in').send({
        email: 'test@example.com'
        // password manquant
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'Données manquantes/invalides. (email et password sont requis et doivent être des chaînes de caractères)'
      );
    });

    // === Connexion Échouée : Email invalide (401):
    it('should return 401 if user does not exist (email invalid)', async () => {
      const response = await request(app).post('/api/auth/sign-in').send({
        email: 'test-invalid@example.com',
        password: 'password123'
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        'error',
        'Email ou mot de passe incorrect'
      );
    });

    // === Connexion Échouée : Password invalide (401):

    it('should return 401 if user does not exist (password invalid)', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const existingUser = {
        id: 1,
        username: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      const response = await request(app).post('/api/auth/sign-in').send({
        email: 'test@example.com',
        password: 'password123-invalid'
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        'error',
        'Email ou mot de passe incorrect'
      );
    });

    // === Création Échoué : Erreur serveur (500) :
    it('should return 500 if there is a server error', async () => {
      // Mock de la connection d'utilisateur pour simuler une erreur serveur :
      prismaMock.user.findUnique.mockRejectedValue(new Error('Server error'));

      const response = await request(app).post('/api/auth/sign-in').send({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Erreur serveur');
    });
  });
});
