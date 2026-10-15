import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { addRepoToQueue } from './queues/ingestionQueue';
import { prisma } from './db/prisma';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { chatRouter } from './routes/chat';
import { initializeQdrant } from './config/qdrant';
import { requireAuth, AuthenticatedRequest } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check endpoint for uptime monitoring
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

// POST /api/repos
app.post('/api/repos', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { repoUrl, name } = req.body;

    if (!repoUrl || !name) {
      res.status(400).json({
        error: 'repoUrl and name are required'
      });
      return;
    }

    const targetUserId = req.userId;
    if (!targetUserId) {
      res.status(401).json({ error: 'Authentication required. Please sign in with your GitHub account.' });
      return;
    }

    // Check if repo is already registered for this user
    let existingRepo = await prisma.repo.findFirst({
      where: { userId: targetUserId, githubUrl: repoUrl }
    });

    if (existingRepo) {
      if (existingRepo.status === 'FAILED') {
        await prisma.repo.update({
          where: { id: existingRepo.id },
          data: { status: 'QUEUED' }
        });
        await addRepoToQueue(repoUrl, existingRepo.id);
      }
      res.status(200).json({
        message: 'Repository already queued or indexed',
        repoId: existingRepo.id,
        status: existingRepo.status === 'FAILED' ? 'QUEUED' : existingRepo.status
      });
      return;
    }

    const repository = await prisma.repo.create({
      data: {
        userId: targetUserId,
        githubUrl: repoUrl,
        name: name,
        status: 'QUEUED'
      }
    });

    await addRepoToQueue(repoUrl, repository.id);

    res.status(202).json({
      message: 'Repository queued for processing',
      repoId: repository.id
    });

  } catch (error: any) {
    console.error('[Repo Ingestion Error]:', error);
    res.status(500).json({
      error: error.message || 'Internal Server Error'
    });
  }
});

// GET /api/repos (Public list)
app.get('/api/repos', async (req: Request, res: Response) => {
  try {
    const repos = await prisma.repo.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });

    const formatted = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      githubUrl: repo.githubUrl,
      branch: repo.defaultBranch || 'main',
      status: repo.status,
      chunkCount: repo.chunkCount || repo._count.chunks || 0,
      indexedFileCount: repo.indexedFileCount,
      totalFileCount: repo.totalFileCount,
      updatedAt: repo.updatedAt
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// GET /api/repos/:id (Single repository status & code chunks)
app.get('/api/repos/:id', async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id as string;
    const repo = await prisma.repo.findUnique({
      where: { id: targetId },
      include: {
        chunks: {
          select: {
            id: true,
            filePath: true,
            startLine: true,
            endLine: true,
            language: true,
            content: true
          },
          orderBy: { filePath: 'asc' }
        },
        _count: {
          select: { chunks: true }
        }
      }
    }) as any;

    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    res.status(200).json({
      id: repo.id,
      name: repo.name,
      githubUrl: repo.githubUrl,
      branch: repo.defaultBranch || 'main',
      status: repo.status,
      chunkCount: repo.chunkCount || repo._count?.chunks || 0,
      indexedFileCount: repo.indexedFileCount,
      totalFileCount: repo.totalFileCount,
      updatedAt: repo.updatedAt,
      chunks: repo.chunks || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch repository status' });
  }
});

// Chat routes
app.use('/api/chat', chatRouter);

// Initialize Qdrant and start server
initializeQdrant()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize Qdrant before starting server:', err);
    process.exit(1);
  });