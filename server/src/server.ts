import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { addRepoToQueue } from './queues/ingestionQueue';
import { prisma } from './db/prisma';
import { chatRouter } from './routes/chat';
import { initializeQdrant } from './config/qdrant';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/repos', async (req: Request, res: Response) => {
  try {
    const { repoUrl, name, userId } = req.body;

    if (!repoUrl || !name) {
      res.status(400).json({
        error: 'repoUrl and name are required'
      });
      return;
    }

    let targetUserId = userId;
    if (!targetUserId) {
      const demoUser = await prisma.user.upsert({
        where: { email: 'demo@repomind.local' },
        update: {},
        create: { email: 'demo@repomind.local' },
      });
      targetUserId = demoUser.id;
    }

    const repository = await prisma.repo.create({
      data: {
        userId: targetUserId,
        githubUrl: repoUrl,
        name: name,
      }
    });

    await addRepoToQueue(
      repoUrl,
      repository.id
    );

    res.status(202).json({
      message: 'Repository queued for processing',
      repoId: repository.id
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Internal Server Error'
    });
  }
});

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

app.use('/api/chat', chatRouter);

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