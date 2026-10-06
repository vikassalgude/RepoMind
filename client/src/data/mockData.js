export const MOCK_FILES = {
  'server/src/utils/chunker.ts': {
    path: 'server/src/utils/chunker.ts',
    name: 'chunker.ts',
    language: 'TypeScript',
    chunkInfo: { title: 'AST Vector Chunk #14', dims: '3072 dims', score: '0.892' },
    lines: [
      { num: 80, text: "import Parser from 'web-tree-sitter';", type: 'import' },
      { num: 81, text: "import { QdrantClient } from '@qdrant/js-client-rest';", type: 'import' },
      { num: 82, text: "", type: 'empty' },
      { num: 83, text: "// Core AST Chunking logic for multi-language ingestion", type: 'comment' },
      { num: 84, text: "export interface ChunkResult {", type: 'keyword' },
      { num: 85, text: "  id: string; content: string; startLine: number; endLine: number;", type: 'normal' },
      { num: 86, text: "export async function generateASTChunks(code: string, language: string): Promise<ChunkResult[]> {", type: 'function' },
      { num: 87, text: "  await Parser.init();", type: 'normal' },
      { num: 88, text: "  const parser = new Parser();", type: 'normal' },
      { num: 89, text: "  const Lang = await Parser.Language.load(`/tree-sitter-${language}.wasm`);", type: 'normal' },
      { num: 90, text: "  parser.setLanguage(Lang);", type: 'normal' },
      { num: 91, text: "  const tree = parser.parse(code);", type: 'normal' },
      { num: 92, text: "  const chunks: ChunkResult[] = [];", type: 'normal' },
      { num: 93, text: "", type: 'empty' },
      { num: 94, text: "  // Traverse top-level AST nodes (functions, classes, interfaces)", type: 'comment' },
      { num: 95, text: "  function traverse(node: Parser.SyntaxNode) {", type: 'keyword' },
      { num: 96, text: "    if (['function_declaration', 'class_declaration'].includes(node.type)) {", type: 'normal' },
      { num: 97, text: "      chunks.push({ id: crypto.randomUUID(), content: node.text });", type: 'normal' },
      { num: 98, text: "    }", type: 'normal' },
      { num: 99, text: "  }", type: 'normal' },
    ]
  },
  'server/src/workers/ingestionWorker.ts': {
    path: 'server/src/workers/ingestionWorker.ts',
    name: 'ingestionWorker.ts',
    language: 'TypeScript',
    chunkInfo: { title: 'Queue Worker Chunk #02', dims: '3072 dims', score: '0.941' },
    lines: [
      { num: 10, text: "import { Worker } from 'bullmq';", type: 'import' },
      { num: 11, text: "import { generateEmbeddings } from '../utils/embeddings';", type: 'import' },
      { num: 12, text: "export const ingestionWorker = new Worker('ingestion-queue', async (job) => {", type: 'function' },
      { num: 13, text: "  const { repoId, fileTree } = job.data;", type: 'normal' },
      { num: 14, text: "  console.log(`[IngestionWorker] Processing repo: ${repoId}`);", type: 'comment' },
      { num: 15, text: "  const chunks = await processRepoFiles(fileTree);", type: 'normal' },
      { num: 16, text: "  const embeddings = await generateEmbeddings(chunks);", type: 'normal' },
      { num: 17, text: "  await qdrantClient.upsert('repomind_chunks', { points: embeddings });", type: 'normal' },
      { num: 18, text: "  return { status: 'completed', chunkCount: chunks.length };", type: 'keyword' },
      { num: 19, text: "});", type: 'normal' }
    ]
  },
  'server/src/server.ts': {
    path: 'server/src/server.ts',
    name: 'server.ts',
    language: 'TypeScript',
    chunkInfo: { title: 'Express Server Entry', dims: 'N/A', score: '0.750' },
    lines: [
      { num: 1, text: "import express from 'express';", type: 'import' },
      { num: 2, text: "import cors from 'cors';", type: 'import' },
      { num: 3, text: "import { chatRouter } from './routes/chat';", type: 'import' },
      { num: 4, text: "", type: 'empty' },
      { num: 5, text: "const app = express();", type: 'normal' },
      { num: 6, text: "app.use(cors());", type: 'normal' },
      { num: 7, text: "app.use(express.json());", type: 'normal' },
      { num: 8, text: "app.use('/api/chat', chatRouter);", type: 'function' },
      { num: 9, text: "", type: 'empty' },
      { num: 10, text: "app.listen(3001, () => console.log('RepoMind Server listening on port 3001'));", type: 'keyword' }
    ]
  },
  'package.json': {
    path: 'package.json',
    name: 'package.json',
    language: 'JSON',
    chunkInfo: { title: 'Package Configuration', dims: 'N/A', score: 'N/A' },
    lines: [
      { num: 1, text: "{", type: 'normal' },
      { num: 2, text: '  "name": "repomind-server",', type: 'keyword' },
      { num: 3, text: '  "version": "1.0.0",', type: 'normal' },
      { num: 4, text: '  "dependencies": {', type: 'normal' },
      { num: 5, text: '    "@google/genai": "^0.1.1",', type: 'normal' },
      { num: 6, text: '    "@qdrant/js-client-rest": "^1.13.0",', type: 'normal' },
      { num: 7, text: '    "web-tree-sitter": "^0.22.6"', type: 'normal' },
      { num: 8, text: "  }", type: 'normal' },
      { num: 9, text: "}", type: 'normal' }
    ]
  }
};

export const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'user',
    text: 'How is AST chunking implemented and what languages are supported?'
  },
  {
    id: 'msg-2',
    sender: 'ai',
    text: 'AST chunking in RepoMind is implemented in server/src/utils/chunker.ts using web-tree-sitter. Rather than splitting by raw line counts, it parses source code into an Abstract Syntax Tree to preserve structural units (functions, classes, interfaces).',
    supportedLanguages: ['TypeScript & JavaScript (.ts, .tsx, .js)', 'Python (.py)', 'Go (.go)', 'Rust (.rs)'],
    citations: [
      {
        path: 'server/src/utils/chunker.ts',
        description: 'generateASTChunks() implementation',
        startLine: 86,
        endLine: 136,
        isPrimary: true
      },
      {
        path: 'server/src/workers/ingestionWorker.ts',
        description: 'Queue listener & Qdrant upsert pipeline',
        startLine: 12,
        endLine: 45,
        isPrimary: false
      }
    ]
  }
];
