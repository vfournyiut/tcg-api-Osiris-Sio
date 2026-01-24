import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../src/database';
import { CardModel } from '../src/generated/prisma/models/Card';
import { PokemonType } from '../src/generated/prisma/enums';

async function main() {
  console.log('🌱 Starting database seed...');

  // Repartir de zéro (init) :

  //   await prisma.deckCard.deleteMany();
  //   await prisma.deck.deleteMany();
  //   await prisma.card.deleteMany();
  //   await prisma.user.deleteMany();

  // Execute TRUNCATE pour vider toutes les tables et réinitialiser les Id auto-incrémentés.
  await prisma.$executeRaw`TRUNCATE TABLE "User", "Card", "Deck", "DeckCard" RESTART IDENTITY;`;

  // User :

  const hashedPassword = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      {
        username: 'red',
        email: 'red@example.com',
        password: hashedPassword
      },
      {
        username: 'blue',
        email: 'blue@example.com',
        password: hashedPassword
      }
    ]
  });

  const redUser = await prisma.user.findUnique({
    where: { email: 'red@example.com' }
  });
  const blueUser = await prisma.user.findUnique({
    where: { email: 'blue@example.com' }
  });

  if (!redUser || !blueUser) {
    throw new Error('Failed to create users');
  }

  console.log('✅ Created users:', redUser.username, blueUser.username);

  // Card :

  const pokemonDataPath = join(__dirname, 'data', 'pokemon.json');
  const pokemonJson = readFileSync(pokemonDataPath, 'utf-8');
  const pokemonData: CardModel[] = JSON.parse(pokemonJson);

  const createdCards = await Promise.all(
    pokemonData.map((pokemon) =>
      prisma.card.create({
        data: {
          name: pokemon.name,
          hp: pokemon.hp,
          attack: pokemon.attack,
          type: PokemonType[pokemon.type as keyof typeof PokemonType],
          pokedexNumber: pokemon.pokedexNumber,
          imgUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.pokedexNumber}.png`
        }
      })
    )
  );

  console.log(`✅ Created ${pokemonData.length} Pokemon cards`);

  // Fonction :
  const getDixCartesAleatoire = (cartes: { id: number }[]) => {
    // Retourne un tableau avec les Id de 10 cartes aléatoires différentes à partir du tableau de cartes passé en paramètre.
    const tabAleatoire = [...cartes].sort(() => 0.5 - Math.random()); // Mélange une copie du tableau
    return tabAleatoire.slice(0, 10); // Retourne un tableau avec les 10 premiers éléments
  };

  // Deck Red :
  const redRandomCards = getDixCartesAleatoire(createdCards);
  await prisma.deck.create({
    data: {
      name: 'Starter Deck',
      user: {
        connect: { id: redUser.id }
      },
      deckCard: {
        create: redRandomCards.map((card) => ({
          card: {
            connect: { id: card.id }
          }
        }))
      }
    }
  });

  // Deck Blue :
  const blueRandomCards = getDixCartesAleatoire(createdCards);
  await prisma.deck.create({
    data: {
      name: 'Starter Deck',
      user: {
        connect: { id: blueUser.id }
      },
      deckCard: {
        create: blueRandomCards.map((card) => ({
          card: {
            connect: { id: card.id }
          }
        }))
      }
    }
  });

  // Vérifications des 2 decks :

  const redDeck = await prisma.deck.findFirst({
    where: { userId: redUser.id }
  });
  const blueDeck = await prisma.deck.findFirst({
    where: { userId: blueUser.id }
  });

  if (!redDeck || !blueDeck) {
    throw new Error('Failed to create decks');
  }

  console.log('✅ Created decks:', redDeck.name, ' et ', blueDeck.name);

  // Message de fin (succès) :
  console.log('\n🎉 Database seeding completed!');
}

//================ Main :

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
