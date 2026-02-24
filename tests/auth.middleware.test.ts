import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest'
import request from 'supertest'
import { app } from '../src/index.js'
import jwt from 'jsonwebtoken'
import { socketAuthenticator } from '../src/auth.middleware'

// Annuler le mock global pour ce fichier de test afin de tester l'implémentation réelle
vi.unmock('../src/auth.middleware')

describe("Middleware d'authentification", () => {
  const userPayload = {
    userId: 1,
    email: 'test@example.com',
  }
  let token: string

  // Créer un token valide avant chaque test :
  beforeEach(() => {
    token = jwt.sign(userPayload, process.env.JWT_SECRET as string, {
      expiresIn: '7 days',
    })
  })

  // On réinitialise le mock d'authentification à son état par défaut (authentifié) avant chaque test :
  beforeEach(() => {
    vi.resetModules()
  })

  // === Accès autorisé : Token valide (Next + 200) :
  it('should allow access if a valid token is provided', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${token}`) // On inclut le token dans le header Authorization

    // La route /api/health est protégée. Si on obtient un statut 200, cela signifie que le middleware a correctement fonctionné :
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      message: 'TCG Backend Server is running',
    })
  })

  // === Accès refusé : Token maquant (401) :
  it('should return 401 if no token is provided', async () => {
    const response = await request(app).get('/api/health')

    // Vérifier :
    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Token manquant' })
  })

  // === Accès refusé : Token invalide ou expiré (401) :
  it('should return 401 if the token is invalid or expired', async () => {
    const invalidToken = jwt.sign(userPayload, 'mauvais-secret', {
      expiresIn: '7 days',
    })
    const response = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${invalidToken}`)

    // Vérifier :
    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Token invalide ou expiré' })
  })

  // === Authentification via socket :
  describe('socketAuthenticator', () => {
    let mockSocket: any
    let next: Mock<(err?: Error) => void>

    beforeEach(() => {
      mockSocket = {
        handshake: {
          auth: {},
        },
        user: undefined,
      }
      next = vi.fn() // On crée un mock pour la fonction next
    })

    // === Authentification via socket : Token valide (Next + User) :
    it('should allow connection if a valid token is provided', () => {
      mockSocket.handshake.auth.token = token

      socketAuthenticator(mockSocket, next)

      // Vérifier :
      expect(next).toHaveBeenCalledWith()
      expect(mockSocket.user).toEqual(userPayload) // Vérifier que le socket.user contient bien l'utilisateur authentifié
    })

    // === Authentification via socket : Token manquant (401) :
    it('should fail connection if no token is provided', () => {
      mockSocket.handshake.auth.token = undefined

      socketAuthenticator(mockSocket, next)

      // Vérifier :
      expect(next).toHaveBeenCalledWith(expect.any(Error))
      expect(next.mock.calls[0]![0]!.message).toContain('Token manquant') // Vérifier que le message contient "Token manquant"
    })

    // === Authentification via socket : Token invalide (401) :
    it('should fail connection if the token is invalid', () => {
      const invalidToken = jwt.sign(userPayload, 'wrong-secret')
      mockSocket.handshake.auth.token = invalidToken

      socketAuthenticator(mockSocket, next)

      // Vérifier :
      expect(next).toHaveBeenCalledWith(expect.any(Error))
      expect(next.mock.calls[0]![0]!.message).toContain('Token invalide') // Vérifier que le message contient "Token invalide"
    })
  })
})
