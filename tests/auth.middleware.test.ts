import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import jwt from 'jsonwebtoken';

// Annuler le mock global pour ce fichier de test afin de tester l'implémentation réelle
vi.unmock('../src/auth.middleware');

describe("Middleware d'authentification", () => {
  const userPayload = {
    userId: 1,
    email: 'test@example.com'
  };
  let token: string;

  // Créer un token valide avant chaque test :
  beforeEach(() => {
    token = jwt.sign(userPayload, process.env.JWT_SECRET as string, {
      expiresIn: '7 days'
    });
  });

  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test :
  beforeEach(() => {
    vi.resetModules();
  });

  // === Accès autorisé : Token valide (Next + 200) :
  it('should allow access if a valid token is provided', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${token}`); // On inclut le token dans le header Authorization

    // La route /api/health est protégée. Si on obtient un statut 200, cela signifie que le middleware a correctement fonctionné :
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'TCG Backend Server is running'
    });
  });

  // === Accès refusé : Token maquant (401) :
  it('should return 401 if no token is provided', async () => {
    const response = await request(app).get('/api/health');

    // Vérifier :
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token manquant' });
  });

  // === Accès refusé : Token invalide ou expiré (401) :
  it('should return 401 if the token is invalid or expired', async () => {
    const invalidToken = jwt.sign(userPayload, 'mauvais-secret', {
      expiresIn: '7 days'
    });
    const response = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${invalidToken}`);

    // Vérifier :
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token invalide ou expiré' });
  });
});
