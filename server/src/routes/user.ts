import express, { Response } from 'express';
import axios from 'axios';
import { prisma } from '../db/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const userRouter = express.Router();

/**
 * GET /api/user/repos
 * Protected route fetching live GitHub repositories for the authenticated user
 * and cross-referencing indexing status from PostgreSQL.
 */
userRouter.get('/repos', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, githubToken: true }
    });

    if (!user || !user.githubToken) {
      res.status(400).json({ error: 'GitHub account token not linked. Please re-authenticate via GitHub.' });
      return;
    }

    const githubResponse = await axios.get(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator',
      {
        headers: {
          Authorization: `Bearer ${user.githubToken}`,
          'User-Agent': 'RepoMind-App',
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    const githubRepos = githubResponse.data || [];

    const indexedRepos = await prisma.repo.findMany({
      where: { userId },
      select: {
        id: true,
        githubUrl: true,
        status: true,
        name: true
      }
    });

    const indexedMap = new Map<string, typeof indexedRepos[0]>();
    indexedRepos.forEach((repo) => {
      indexedMap.set(repo.githubUrl.toLowerCase(), repo);
      const urlParts = repo.githubUrl.replace(/\/$/, '').split('/');
      if (urlParts.length >= 2) {
        const repoFullName = `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`.toLowerCase();
        indexedMap.set(repoFullName, repo);
      }
    });

    const result = githubRepos.map((ghRepo: any) => {
      const htmlUrl = (ghRepo.html_url || '').toLowerCase();
      const fullName = (ghRepo.full_name || '').toLowerCase();

      const matchedRepo = indexedMap.get(htmlUrl) || indexedMap.get(`${htmlUrl}.git`) || indexedMap.get(fullName);

      return {
        name: ghRepo.name,
        full_name: ghRepo.full_name,
        description: ghRepo.description,
        isPrivate: !!ghRepo.private,
        private: !!ghRepo.private,
        html_url: ghRepo.html_url,
        default_branch: ghRepo.default_branch || 'main',
        language: ghRepo.language || 'UNKNOWN',
        isIndexed: !!matchedRepo,
        repoId: matchedRepo ? matchedRepo.id : null,
        status: matchedRepo ? matchedRepo.status : null
      };
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[User Repos Sync Error]:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch repositories from GitHub' });
  }
});
