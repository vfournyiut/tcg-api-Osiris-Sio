import { type Request, type Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database';

export const signInRouter = Router();

// POST /auth/login
// Accessible via POST /api/auth/sign-in
/**
 * Route pour connecter un utilisateur existant.
 * Vérifie les identifiants et retourne un token JWT.
 *
 * @name POST /api/auth/sign-in
 * @function
 * @memberof module:routes/auth
 * @param {Request} req - La requête Express contenant email et password.
 * @param {Response} res - La réponse Express.
 * @returns {Promise<Response>} - Une réponse JSON contenant le token et les infos utilisateur.
 * @throws {400} Données manquantes ou invalides.
 * @throws {401} Email ou mot de passe incorrect.
 * @throws {500} Erreur serveur.
 *
 * @example
 * // Corps de la requête (req.body) :
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 */
signInRouter.post('/sign-in', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Si au moins l'une des données est manquante/invalide, alors erreur 400 (côté client) :
  if (
    !email ||
    typeof email !== 'string' ||
    !password ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({
      error:
        'Données manquantes/invalides. (email et password sont requis et doivent être des chaînes de caractères)'
    });
  }

  try {
    // Vérifier que l'utilisateur existe :
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe :
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le JWT :
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7 days' } // Le token expire dans 7 jours
    );

    // Retourner le token :
    return res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Erreur lors de la connexion : ', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
