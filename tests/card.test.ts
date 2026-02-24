import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { prismaMock } from './vitest.setup.js'
import { app } from '../src/index.js'
import { PokemonType } from '../src/generated/prisma/enums'

describe('Cards API', () => {
  // Consultation des cartes :

  // === Consultation Réussie (200) :
  it('should return an array of cards', async () => {
    // Mock de la récupération des cartes :
    prismaMock.card.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Bulbasaur',
        hp: 45,
        attack: 49,
        type: PokemonType.Grass,
        pokedexNumber: 1,
        imgUrl: 'url1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 35,
        name: 'Ivysaur',
        hp: 60,
        attack: 62,
        type: PokemonType.Grass,
        pokedexNumber: 2,
        imgUrl: 'url2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const response = await request(app).get('/api/cards')

    // Vérifications :
    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(2)
    expect(response.body[0]).toHaveProperty('name', 'Bulbasaur')
  })

  // === Consultation Échoué : Erreur serveur (500) :
  it('should return 500 if there is a server error', async () => {
    // Mock de la consultation des cartes pour simuler une erreur serveur :
    prismaMock.card.findMany.mockRejectedValue(new Error('Server error'))

    const response = await request(app).get('/api/cards')

    expect(response.status).toBe(500)
    expect(response.body).toHaveProperty('error', 'Erreur serveur')
  })
})
