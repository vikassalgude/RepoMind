import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import { prisma } from '../db/prisma';
import { generateEmbedding } from '../config/gemini';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';

export const chatRouter = express.Router();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

interface ChatMessage {
  sender?: 'user' | 'ai' | 'assistant';
  role?: 'user' | 'assistant' | 'system';
  text?: string;
  content?: string;
}

interface ChatRequest {
  repoId: string;
  query: string;
  messages?: ChatMessage[];
}

/**
 * POST /api/chat/query
 * Non-streaming RAG retrieval endpoint for inspecting retrieved code chunks.
 */
chatRouter.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const { repoId, query } = req.body as ChatRequest;

    if (!repoId || !query) {
      res.status(400).json({ error: 'repoId and query are required' });
      return;
    }

    const queryVector = await generateEmbedding(query);

    // Support both Qdrant JS SDK v1.x (.search) and v2.x (.query) method signatures
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
 * Server-Sent Events (SSE) RAG streaming endpoint powered by Groq LLM.
 */
chatRouter.post('/stream', async (req: Request, res: Response): Promise<void> => {
  const { repoId, query, messages = [] } = req.body as ChatRequest;

  if (!repoId || !query) {
    res.status(400).json({ error: 'repoId and query are required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
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
    const chunkIds = points.map((point: any) => String(point.id));

    let dbChunks = chunkIds.length > 0
      ? await prisma.chunk.findMany({
          where: {
            qdrantId: {
              in: chunkIds
            }
          }
        })
      : [];

    // Fallback: If vector similarity search yields 0 hits, retrieve default repo chunks
    if (dbChunks.length === 0) {
      dbChunks = await prisma.chunk.findMany({
        where: { repoId },
        take: 8
      });
    }

    if (dbChunks.length === 0) {
      res.write(`data: ${JSON.stringify({ text: 'No indexed code context found in the database for this repository.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const contextFormatted = dbChunks
      .map(
        (chunk, idx) =>
          `--- SNIPPET ${idx + 1} ---\nFile: ${chunk.filePath} (Lines ${chunk.startLine}-${chunk.endLine})\nLanguage: ${chunk.language}\nContent:\n${chunk.content}`
      )
      .join('\n\n');

    const systemPrompt = `You are RepoMind AI, an expert GitHub repository assistant.
- If the user greets you or asks about your identity, respond naturally and concisely.
- If asked about architecture or flow, output valid Mermaid.js code wrapped in \`\`\`mermaid blocks.
- When generating Mermaid diagrams, follow these STRICT syntax rules:
  1. EVERY node label MUST be wrapped in double quotes (e.g., A["Next.js UI (React)"] --> B["API Routes"]). Never use unquoted parentheses, brackets, or slashes.
  2. NEVER put inline \`%%\` comments on node definition lines. All comments must be on their own separate lines.
  3. Use standard plain text for node labels and avoid special unicode characters.
- Break down complex explanations into clear, numbered steps.
- Bold key concepts and variables for readability.
- Never complain about missing files; synthesize answers using the available snippets and README.
- Always cite files using this exact inline format: \`path/to/file:startLine-endLine\`.

RETRIEVED CODE CONTEXT:
${contextFormatted}`;

    const conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = (messages || [])
      .map((msg) => {
        const isUser = msg.sender === 'user' || msg.role === 'user';
        const textContent = msg.text || msg.content || '';
        return {
          role: (isUser ? 'user' : 'assistant') as 'user' | 'assistant',
          content: textContent
        };
      })
      .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0);

    const completionMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: query }
    ];

    const stream = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: completionMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('[Chat Stream API] Error during Groq streaming:', error);
    const errMsg = error?.status === 429 || error?.message?.includes('429')
      ? 'Rate limit exceeded (429). Please try again in a few moments.'
      : error?.message || 'Internal streaming error';
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});