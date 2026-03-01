import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'
import { vi, beforeEach } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/client'
import { prisma } from '../src/database'

vi.mock('../src/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

// On crée un objet mock pour l'authentification qu'on pourra manipuler dans les tests :
export const authMock = {
  authenticateToken: vi.fn((req, _res, next) => {
    // Par défaut, on simule un utilisateur authentifié :
    req.user = { userId: 1 }
    next()
  }),
  socketAuthenticator: vi.fn((socket, next) => {
    // Par défaut, on simule un utilisateur authentifié :
    socket.user = { userId: 1 }
    next()
  }),
}

// Mock du middleware d'authentification :
vi.mock('../src/auth.middleware', () => authMock)

beforeEach(() => {
  mockReset(prismaMock)
})

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
