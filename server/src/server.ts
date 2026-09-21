import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
//import {v4 as uuidv4} from 'uuid'
import { addRepoToQueue } from './queues/ingestionQueue';
import { prisma } from './db/prisma';
//import { ingestionWorker } from './workers/ingestionWorker';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// app.post('/api/repos', async (req: Request, res: Response) => {
//   try {
//     const { repoUrl } = req.body;
    
//     if (!repoUrl) {
//        res.status(400).json({ error: "repoUrl is required" });
//        return;
//     }

//     // const mockRepoId = uuidv4(); 
    
//     await addRepoToQueue(repoUrl, mockRepoId);

//     // Respond immediately so the user isn't kept waiting
//     res.status(202).json({ 
//       message: "Repository queued for processing", 
//       repoId: mockRepoId 
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

app.post('/api/repos', async (req: Request, res: Response) => {
  try {
    const { repoUrl, name } = req.body;

    if (!repoUrl || !name) {
      res.status(400).json({
        error: 'repoUrl and name are required'
      });
      return;
    }

    // 1. Create repository in PostgreSQL
    const repository = await prisma.repository.create({
      data: {
        url: repoUrl,
        name: name
      }
    });

    // 2. Add the real database ID to BullMQ
    await addRepoToQueue(
      repoUrl,
      repository.id
    );

    // 3. Respond immediately
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});