import { Worker, Job } from 'bullmq';
import axios from 'axios';
import crypto from 'crypto';
import { connection } from '../config/redis';
import { prisma } from '../db/prisma';
import { Language } from '@prisma/client';
import { generateASTChunks, getLanguageEnum } from '../utils/chunker';
import { generateEmbedding } from '../config/gemini';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';
import { withExponentialBackOff } from '../utils/backoff';

export const ingestionWorker = new Worker('repo-ingestion', async (job: Job) => {
  const { repoUrl, repoId } = job.data;
  console.log(`[Worker] Started processing: ${repoUrl}`);

  try {
    await prisma.repo.update({
      where: { id: repoId },
      data: { status: 'INDEXING' }
    });

    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    const owner = match[1];
    const repoName = match[2].replace(/\.git$/, '');

    const githubHeaders: Record<string, string> = {
      'User-Agent': 'RepoMind-App',
    };
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim() !== '') {
      githubHeaders['Authorization'] = `token ${process.env.GITHUB_TOKEN.trim()}`;
    }

    const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: githubHeaders
    });
    const defaultBranch = repoInfo.data.default_branch;

    const treeUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees/${defaultBranch}?recursive=1`;
    const treeResponse = await axios.get(treeUrl, {
      headers: githubHeaders
    });
    
    if (!treeResponse.data.tree) throw new Error("Failed to fetch repository tree");

    const isProcessableFile = (path: string) => {
      const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.pdf', '.woff', '.ttf', '.eot', '.ico'];
      const invalidFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
      const filename = path.split('/').pop();
      return !invalidExtensions.includes(ext) && filename && !invalidFiles.includes(filename);
    };

    const processableFiles = treeResponse.data.tree.filter(
      (file: any) => file.type === 'blob' && isProcessableFile(file.path)
    );

    console.log(`[Worker] Found ${processableFiles.length} files to index.`);
    await prisma.repo.update({
        where: { id: repoId },
        data: { totalFileCount: processableFiles.length }
    });

    let totalChunks = 0;
    let indexedFiles = 0;

    for (const file of processableFiles) {
      try {
        let code: string;
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/${file.path}`;
          const fileResponse = await axios.get(rawUrl, { responseType: 'text' });
          code = fileResponse.data;
        } catch (rawErr) {
          const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}?ref=${defaultBranch}`;
          const fileResponse = await axios.get(apiUrl, {
            responseType: 'text',
            headers: {
              ...githubHeaders,
              Accept: 'application/vnd.github.v3.raw'
            }
          });
          code = fileResponse.data;
        }

        if (typeof code !== 'string') continue;

        const langString = getLanguageEnum(file.path);
        const chunks = await generateASTChunks(code, langString);

        if (chunks.length === 0) continue;

        const qdrantPoints = [];
        const prismaChunks = [];

        for (const chunk of chunks) {
          const vector = await withExponentialBackOff(() => generateEmbedding(chunk.content));

          const qdrantId = crypto.randomUUID(); 

          qdrantPoints.push({
            id: qdrantId,
            vector: vector,
            payload: {
              repoId: repoId,
              filePath: file.path,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              language: langString
            }
          });

          prismaChunks.push({
            repoId: repoId,
            filePath: file.path,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            language: langString as Language,
            content: chunk.content, 
            qdrantId: qdrantId
          });
        }

        if (qdrantPoints.length > 0) {
          await qdrantClient.upsert(COLLECTION_NAME, {
            wait: true, 
            points: qdrantPoints
          });

          await prisma.chunk.createMany({
            data: prismaChunks
          });

          totalChunks += qdrantPoints.length;
        }

        indexedFiles++;

        if (indexedFiles % 5 === 0) {
          await prisma.repo.update({
            where: { id: repoId },
            data: { indexedFileCount: indexedFiles, chunkCount: totalChunks }
          });
          console.log(`[Worker] Progress: ${indexedFiles}/${processableFiles.length} files...`);
        }

      } catch (fileErr: any) {
        console.warn(`[Worker] Skipped ${file.path}: ${fileErr.message}`);
      }
    }

    await prisma.repo.update({
      where: { id: repoId },
      data: { status: 'READY', indexedFileCount: indexedFiles, chunkCount: totalChunks }
    });
    console.log(`[Worker] Successfully completed: ${repoUrl}. Total Chunks: ${totalChunks}`);

  } catch (error: any) {
    console.error(`[Worker] Job failed:`, error.message);
    await prisma.repo.update({
      where: { id: repoId },
      data: { status: 'FAILED' }
    });
    throw error;
  }
  
}, { connection });