import express, { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const authRouter = express.Router();

/**
 * GET /api/auth/github
 * Initiates GitHub OAuth flow by redirecting to GitHub authorization page.
 */
authRouter.get('/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback';
  const scope = 'read:user,user:email,repo';

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scope)}`;

  res.redirect(githubAuthUrl);
});

/**
 * GET /api/auth/github/callback
 * Handles GitHub OAuth callback, exchanges code for access token, upserts user, and issues JWT cookie.
 */
authRouter.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code is missing' });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback';

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      console.error('[Auth OAuth] Access token exchange failed:', tokenResponse.data);
      res.status(400).redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}?error=oauth_token_failed`);
      return;
    }

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'RepoMind-App'
      }
    });

    const userProfile = userResponse.data;
    let email = userProfile.email;

    if (!email) {
      try {
        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'RepoMind-App'
          }
        });

        const emails = emailsResponse.data || [];
        const primaryEmailObj = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified) || emails[0];
        if (primaryEmailObj && primaryEmailObj.email) {
          email = primaryEmailObj.email;
        }
      } catch (emailErr: any) {
        console.warn('[Auth OAuth] Could not fetch private emails:', emailErr.message);
      }
    }

    if (!email) {
      email = `${userProfile.login}@users.noreply.github.com`;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        githubToken: accessToken
      },
      create: {
        email,
        githubToken: accessToken
      }
    });

    const jwtSecret = process.env.JWT_SECRET || 'repomind-secret-key-change-me';
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`);
  } catch (error: any) {
    console.error('[Auth Callback Error]:', error.message || error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}?error=oauth_failed`);
  }
});

/**
 * GET /api/auth/me
 * Protected route returning authenticated user profile.
 */
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * POST /api/auth/logout
 * Clears authentication session cookie.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});
