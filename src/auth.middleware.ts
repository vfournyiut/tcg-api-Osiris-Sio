import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

// Étendre le type Request pour ajouter userId
declare global {
  namespace Express {
    interface Request {
      userId: number;
      password: string;
    }
  }
}

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
  next: NextFunction
) => {
  // 1. Récupérer le token depuis l'en-tête Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    // 2. Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number;
      email: string;
    };

    // 3. Injecter les données utilisateur dans `req.user` comme défini dans `src/types/express.d.ts`
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };

    // 4. Passer au prochain middleware ou à la route
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};
