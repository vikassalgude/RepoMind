import express, { Response } from 'express';
import OpenAI from 'openai';
import { prisma } from '../db/prisma';
import { MessageRole } from '@prisma/client';
import { generateEmbedding } from '../config/gemini';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const chatRouter = express.Router();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

interface ChatRequest {
  repoId: string;
  query: string;
}

/**
 * GET /api/chat/:repoId/messages
 * Protected route returning all saved messages for a repository conversation.
 */
chatRouter.get('/:repoId/messages', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.repoId as string;

    // Find or create conversation for (userId, repoId)
    let conversation = (await prisma.conversation.findFirst({
      where: { userId, repoId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })) as any;

    if (!conversation) {
      conversation = (await prisma.conversation.create({
        data: {
          userId,
          repoId,
          title: 'Repository RAG Chat'
        },
        include: {
          messages: true
        }
      })) as any;
    }

    const messagesList: any[] = conversation.messages || [];
    const formattedMessages = messagesList.map((msg: any) => ({
      id: msg.id,
      sender: msg.role === MessageRole.USER ? 'user' : 'ai',
      role: msg.role,
      text: msg.content,
      citations: msg.citations || [],
      createdAt: msg.createdAt
    }));

    res.status(200).json({
      conversationId: conversation.id,
      messages: formattedMessages
    });
  } catch (error: any) {
    console.error('[Chat Messages Fetch Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

/**
 * POST /api/chat/query
 * Non-streaming RAG retrieval endpoint for inspecting retrieved code chunks.
 */
chatRouter.post('/query', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { repoId, query } = req.body as ChatRequest;

    if (!repoId || !query) {
      res.status(400).json({ error: 'repoId and query are required' });
      return;
    }

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
 * Server-Sent Events (SSE) RAG streaming endpoint with persistent database memory.
 */
chatRouter.post('/stream', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { repoId, query } = req.body as ChatRequest;

  if (!repoId || !query) {
    res.status(400).json({ error: 'repoId and query are required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    let conversation = await prisma.conversation.findFirst({
      where: { userId, repoId }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          repoId,
          title: 'Repository RAG Chat'
        }
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: query
      }
    });

    const previousDbMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

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

    // Fallback: If vector search yields 0 hits, retrieve default top chunks
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

    // Format previous messages (excluding current query which is appended at end)
    const conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = previousDbMessages
      .slice(0, -1)
      .map((msg) => ({
        role: msg.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
        content: msg.content
      }));

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

    let fullText = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }

    if (fullText.trim()) {
      const citationsList: any[] = [];
      const regex = /([a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+):\s*(\d+)-(\d+)/g;
      let match;
      const seen = new Set();
      while ((match = regex.exec(fullText)) !== null) {
        const path = match[1];
        const startLine = parseInt(match[2], 10);
        const endLine = parseInt(match[3], 10);
        const key = `${path}:${startLine}-${endLine}`;
        if (!seen.has(key)) {
          seen.add(key);
          citationsList.push({ path, startLine, endLine, description: 'Source Citation' });
        }
      }

      const citationsPayload = citationsList.length > 0 ? (citationsList as any) : undefined;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: MessageRole.ASSISTANT,
          content: fullText,
          ...(citationsPayload ? { citations: citationsPayload } : {})
        }
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('[Chat Stream API Error]:', error);
    const errMsg = error?.status === 429 || error?.message?.includes('429')
      ? 'Rate limit exceeded (429). Please try again in a few moments.'
      : error?.message || 'Internal streaming error';
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});