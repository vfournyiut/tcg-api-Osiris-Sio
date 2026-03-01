import { type NextFunction, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { Socket } from 'socket.io'

import { env } from './env'

/**
 * Middleware pour authentifier les utilisateurs via un token JWT.
 * Vérifie la présence et la validité du token dans l'en-tête Authorization.
 *
 * @param {Request} req - La requête Express.
 * @param {Response} res - La réponse Express.
 * @param {NextFunction} next - La fonction pour passer au middleware suivant.
 * @returns {void}
 * @throws {401} Token manquant ou invalide.
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Récupérer le token depuis l'en-tête Authorization
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  try {
    // 2. Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number
      email: string
    }

    // 3. Injecter les données utilisateur dans `req.user` comme défini dans `src/types/express.d.ts`
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    }

    // 4. Passer au prochain middleware ou à la route
    return next()
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

/**
 * Middleware Socket.io pour authentifier les clients via un token JWT.
 * Vérifie le token présent dans socket.handshake.auth.token.
 *
 * @param {Socket} socket - L'objet socket de la connexion.
 * @param {Function} next - La fonction pour passer au middleware suivant ou refuser la connexion.
 */
export const socketAuthenticator = (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  const token = socket.handshake.auth.token // Format: "Bearer <token>"

  if (!token) {
    return next(new Error('Authentification échouée : Token manquant'))
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: number
      email: string
    }

    // Injection des informations utilisateur dans le socket :
    socket.user = {
      userId: decoded.userId,
      email: decoded.email,
    }

    return next()
  } catch (_error) {
    return next(new Error('Authentification échouée : Token invalide'))
  }
}
