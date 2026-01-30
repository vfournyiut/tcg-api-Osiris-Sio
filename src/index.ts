import { createServer } from 'http';
import { env } from './env';
import { signUpRouter } from './routes/Auth/sign-up.route';
import { signInRouter } from './routes/Auth/sign-in.route';
import { cardsRouter } from './routes/cards.route';
import express from 'express';
import cors from 'cors';
import { authenticateToken } from './auth.middleware.js';

import 'dotenv/config';

// Create Express app
export const app = express();

// Middlewares
app.use(
  cors({
    origin: true, // Autorise toutes les origines
    credentials: true
  })
);

app.use(express.json());

// Serve static files (Socket.io test client)
app.use(express.static('public'));

// Health check endpoint
// Teste token avec le middleware
app.get('/api/health', authenticateToken, (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' });
});

// ============= Authentification :
// Route pour s'inscrire :
app.use('/api/auth', signUpRouter);

// Route pour se connecter :
app.use('/api/auth', signInRouter);

// ============= Cards :
app.use('/api/cards', cardsRouter);

// Start server only if this file is run directly (not imported for tests)
if (require.main === module) {
  // Create HTTP server
  const httpServer = createServer(app);

  // Start server
  try {
    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`);
      console.log(
        `🧪 Socket.io Test Client available at http://localhost:${env.PORT}`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
