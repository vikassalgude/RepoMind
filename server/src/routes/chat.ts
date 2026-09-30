import express, { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { generateEmbedding, aiClient } from '../config/gemini';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';

export const chatRouter = express.Router();

interface ChatRequest {
  repoId: string;
  query: string;
}

/**
 * POST /api/chat/query
 * Non-streaming RAG retrieval endpoint for context inspectability.
 */
chatRouter.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const { repoId, query } = req.body as ChatRequest;

    if (!repoId || !query) {
      res.status(400).json({ error: 'repoId and query are required' });
      return;
    }

    console.log(`[Chat API] Received non-stream query for repo: ${repoId}`);
    const queryVector = await generateEmbedding(query);

    let searchResults: any;
    if (typeof (qdrantClient as any).search === 'function') {
      searchResults = await (qdrantClient as any).search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 5,
        filter: {
          must: [{ key: 'repoId', match: { value: repoId } }]
        }
      });
    } else {
      searchResults = await qdrantClient.query(COLLECTION_NAME, {
        query: queryVector,
        limit: 5,
        filter: {
          must: [{ key: 'repoId', match: { value: repoId } }]
        }
      });
    }

    const points = Array.isArray(searchResults) ? searchResults : (searchResults?.points || []);

    if (points.length === 0) {
      res.status(200).json({ message: 'No relevant code found.', chunks: [] });
      return;
    }

    const chunkIds = points.map((point: any) => String(point.id));

    const dbChunks = await prisma.chunk.findMany({
      where: {
        qdrantId: {
          in: chunkIds
        }
      }
    });

    res.status(200).json({
      message: 'Retrieval successful',
      chunks: dbChunks
    });

  } catch (error: any) {
    console.error('[Chat API] Retrieval Error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve context' });
  }
});

/**
 * POST /api/chat/stream
 * Server-Sent Events (SSE) Generative RAG Streaming endpoint.
 */
chatRouter.post('/stream', async (req: Request, res: Response): Promise<void> => {
  const { repoId, query } = req.body as ChatRequest;

  // 1. Payload Validation
  if (!repoId || !query) {
    res.status(400).json({ error: 'repoId and query are required' });
    return;
  }

  // 2. SSE Streaming Setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    console.log(`[Chat Stream API] Processing RAG stream for repo: ${repoId}`);

    // 3. Retrieval Pipeline
    // a. Embed user query
    const queryVector = await generateEmbedding(query);

    // b. Search Qdrant vector database filtered strictly by repoId
    let searchResults: any;
    if (typeof (qdrantClient as any).search === 'function') {
      searchResults = await (qdrantClient as any).search(COLLECTION_NAME, {
        vector: queryVector,
        limit: 5,
        filter: {
          must: [{ key: 'repoId', match: { value: repoId } }]
        }
      });
    } else {
      searchResults = await qdrantClient.query(COLLECTION_NAME, {
        query: queryVector,
        limit: 5,
        filter: {
          must: [{ key: 'repoId', match: { value: repoId } }]
        }
      });
    }

    const points = Array.isArray(searchResults) ? searchResults : (searchResults?.points || []);
    const chunkIds = points.map((point: any) => String(point.id));

    // c. Query PostgreSQL via Prisma for raw code chunks
    const dbChunks = chunkIds.length > 0
      ? await prisma.chunk.findMany({
          where: {
            qdrantId: {
              in: chunkIds
            }
          }
        })
      : [];

    // 4. Handle no context found
    if (dbChunks.length === 0) {
      res.write(`data: ${JSON.stringify({ text: 'No relevant code context found in this repository for your query.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 5. Prompt Construction
    const contextFormatted = dbChunks
      .map(
        (chunk, idx) =>
          `--- SNIPPET ${idx + 1} ---\nFile: ${chunk.filePath} (Lines ${chunk.startLine}-${chunk.endLine})\nLanguage: ${chunk.language}\nContent:\n${chunk.content}`
      )
      .join('\n\n');

    const systemPrompt = `You are a world-class senior backend engineer analyzing a software repository.
Your task is to answer the user's question using ONLY the retrieved code snippets provided below.

CRITICAL INSTRUCTIONS:
1. Base your answer strictly and exclusively on the code context provided. Do NOT invent or assume logic not present in the snippets.
2. ALWAYS cite the file path and line numbers when referencing functions, classes, variables, or logic (e.g. \`server/src/utils/chunker.ts:86-136\`).
3. If the provided context is insufficient to answer the question completely, explicitly state what is missing based on the available snippets.
4. Keep your technical explanation concise, structured, precise, and professional.

RETRIEVED CODE CONTEXT:
${contextFormatted}

USER QUESTION:
${query}

RESPONSE:`;

    // 6. Generation Pipeline (Gemini Streaming)
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const modelsToTry = [primaryModel, 'gemini-1.5-flash', 'gemini-flash-latest'];
    let resultStream: any = null;
    let streamError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const model = aiClient.getGenerativeModel({ model: modelName });
        resultStream = await model.generateContentStream(systemPrompt);
        break;
      } catch (err) {
        streamError = err;
      }
    }

    if (!resultStream) {
      throw streamError || new Error('Failed to initialize Gemini streaming model');
    }

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    // End of stream signal
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('[Chat Stream API] Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Internal streaming error' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});