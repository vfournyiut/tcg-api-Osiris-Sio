import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prismaMock } from './vitest.setup.js';
import { app } from '../src/index.js';
import { PokemonType } from '../src/generated/prisma/enums';

describe('Cards API', () => {
  // Consultation des cartes :

  it('should return a list of cards', async () => {
    const card1 = {
      id: 1,
      name: 'Bulbasaur',
      hp: 45,
      attack: 49,
      type: PokemonType.Grass,
      pokedexNumber: 1,
      imgUrl: 'url1',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const card2 = {
      id: 35,
      name: 'Ivysaur',
      hp: 60,
      attack: 62,
      type: PokemonType.Grass,
      pokedexNumber: 2,
      imgUrl: 'url2',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    prismaMock.card.create.mockResolvedValue(card1);
    prismaMock.card.create.mockResolvedValue(card2);

    const response = await request(app).get('/api/cards');

    expect(response.status).toBe(200);

    expect(response.body.cards).toEqual([
      {
        id: card1.id,
        name: card1.name,
        hp: card1.hp,
        attack: card1.attack,
        type: card1.type,
        pokedexNumber: card1.pokedexNumber,
        imgUrl: card1.imgUrl
      },
      {
        id: card2.id,
        name: card2.name,
        hp: card2.hp,
        attack: card2.attack,
        type: card2.type,
        pokedexNumber: card2.pokedexNumber,
        imgUrl: card2.imgUrl
      }
    ]);
  });
});
