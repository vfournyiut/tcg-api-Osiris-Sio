import { type Request, type Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database';

export const signUpRouter = Router();

// POST: Créer un utilisateur
// Accessible via POST /api/auth/sign-up
signUpRouter.post('/sign-up', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  // Si au moins l'une des données est manquante/invalide, alors erreur 400 (côté client) :
  if (
    !username ||
    typeof username !== 'string' ||
    !email ||
    typeof email !== 'string' ||
    !password ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({
      error:
        'Données manquantes/invalides. (username, email et password sont requis et doivent être des chaînes de caractères)'
    });
  }

  // Validation de l'email (seulement le '@' et '.', sinon erreur 400) :
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  try {
    // Vérifier s'il y a déjà un utilisateur avec cet email :
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Si oui, l'utilisateur est informé (erreur 409) :
    if (user) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    // Hasher le mot de passe :
    const hashedPassword = await bcrypt.hash(password, 10);

    // Ajoute l'utilisateur dans la base de données :
    const newUser = await prisma.user.create({
      data: { username, email, password: hashedPassword }
    });

    // Générer le JWT avec l'ID de l'utilisateur
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7 days' } // Le token expire dans 7 jours
    );

    // Retourner le token et l'utilisateur inscris :
    return res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error("Erreur lors de l'inscription : ", error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
