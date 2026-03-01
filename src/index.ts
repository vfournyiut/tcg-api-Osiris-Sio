import 'dotenv/config'

import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import swaggerUi from 'swagger-ui-express'

import { authenticateToken, socketAuthenticator } from './auth.middleware.js'
import { swaggerDocument } from './docs/index'
import { env } from './env'
import { handleGameEvents } from './game.js'
import { handleRoomEvents } from './room.js'
import { signInRouter } from './routes/Auth/sign-in.route'
import { signUpRouter } from './routes/Auth/sign-up.route'
import { cardsRouter } from './routes/cards.route'
import { decksRouter } from './routes/Decks/decks.route'
import { decksMineRouter } from './routes/Decks/decks-mine.route'
import { deleteDecksIdRouter } from './routes/Decks/delete-decks-id.route'
import { getDecksIdRouter } from './routes/Decks/get-decks-id.route'
import { patchDecksIdRouter } from './routes/Decks/patch-decks-id.route'

// Create Express app
export const app = express()

// Create HTTP server and Socket.io instance
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

// Middlewares
app.use(
  cors({
    origin: true, // Autorise toutes les origines
    credentials: true,
  }),
)

app.use(express.json())

// Serve static files (Socket.io test client)
app.use(express.static('public'))

// Health check endpoint
// Teste token avec le middleware
/**
 * Route de vérification de l'état de l'API.
 * Nécessite un token valide.
 *
 * @name GET /api/health
 * @function
 * @param {Request} _req - La requête Express.
 * @param {Response} res - La réponse Express.
 * @returns {void}
 */
app.get('/api/health', authenticateToken, (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' })
})

// ============= Authentification :
// Route pour s'inscrire :
app.use('/api/auth', signUpRouter)

// Route pour se connecter :
app.use('/api/auth', signInRouter)

// ============= Documentation Swagger :
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Documentation',
  }),
)

// ============= Cards :
app.use('/api/cards', cardsRouter)

// ============= Decks :
app.use('/api/decks', decksRouter) // Créer
app.use('/api/decks', decksMineRouter) // Lister
app.use('/api/decks', getDecksIdRouter) // Lister un deck grâce à son id
app.use('/api/decks', patchDecksIdRouter) // Modifier un deck grâce à son id
app.use('/api/decks', deleteDecksIdRouter) // Supprimer un deck grâce à son id

// ============= Socket.io :
// Utilisation du middleware d'authentification
io.use(socketAuthenticator)

// Écoute des connexions Socket.IO
io.on('connection', (socket) => {
  console.log("Un client authentifié s'est connecté:", socket.id)
  console.log('Utilisateur:', socket.user)

  // Gestion des événements de salle (matchmaking)
  handleRoomEvents(io, socket)

  // Gestion des événements de jeu
  handleGameEvents(io, socket)

  socket.on('disconnect', () => {
    console.log("Un client s'est déconnecté:", socket.id)
  })
})

// Start server only if this file is run directly (not imported for tests)
if (require.main === module) {
  try {
    server.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`)
      console.log(
        `🧪 Socket.io Test Client available at http://localhost:${env.PORT}`,
      )
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}
