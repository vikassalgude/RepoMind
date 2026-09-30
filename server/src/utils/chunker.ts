import Parser from 'web-tree-sitter';
import path from 'path';
import fs from 'fs';

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
}

export function getLanguageEnum(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': return 'JAVASCRIPT';
    case 'ts': case 'tsx': return 'TYPESCRIPT';
    case 'py': return 'PYTHON';
    case 'rb': return 'RUBY';
    case 'java': return 'JAVA';
    case 'cpp': case 'cc': case 'cxx': case 'h': case 'hpp': return 'CPP';
    case 'c': return 'C';
    case 'cs': return 'CSHARP';
    case 'go': return 'GO';
    case 'rs': return 'RUST';
    case 'php': return 'PHP';
    case 'swift': return 'SWIFT';
    case 'kt': case 'kts': return 'KOTLIN';
    case 'md': return 'MARKDOWN';
    case 'json': return 'JSON';
    case 'css': return 'CSS';
    case 'sql': return 'SQL';
    case 'html': return 'HTML';
    case 'yaml': case 'yml': return 'YAML';
    default: return 'UNKNOWN';
  }
}

function getWasmPath(languageEnum: string): string | null {
  const langMap: Record<string, string> = {
    'JAVASCRIPT': 'javascript',
    'TYPESCRIPT': 'typescript',
    'PYTHON': 'python',
    'RUBY': 'ruby',
    'JAVA': 'java',
    'CPP': 'cpp',
    'C': 'c',
    'CSHARP': 'c_sharp',
    'GO': 'go',
    'RUST': 'rust',
    'PHP': 'php',
    'SWIFT': 'swift',
    'JSON': 'json',
    'CSS': 'css',
    'HTML': 'html'
  };

  const wasmName = langMap[languageEnum];
  if (!wasmName) return null;

  return path.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${wasmName}.wasm`);
}

function naiveChunking(code: string): CodeChunk[] {
  const lines = code.split('\n');
  const chunks: CodeChunk[] = [];
  const chunkSize = 50;

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunkLines = lines.slice(i, i + chunkSize);
    chunks.push({
      content: chunkLines.join('\n'),
      startLine: i + 1,
      endLine: i + chunkLines.length
    });
  }
  return chunks;
}

export async function generateASTChunks(code: string, languageEnum: string): Promise<CodeChunk[]> {
  const wasmPath = getWasmPath(languageEnum);
  
  if (!wasmPath || !fs.existsSync(wasmPath)) {
    return naiveChunking(code);
  }

  await Parser.init();
  const parser = new Parser();
  
  try {
    const lang = await Parser.Language.load(wasmPath);
    parser.setLanguage(lang);
  } catch (error) {
    console.warn(`[Chunker] Failed to load WASM for ${languageEnum}. Falling back to naive chunking.`);
    return naiveChunking(code);
  }

  const tree = parser.parse(code);
  if (!tree) {
    return naiveChunking(code);
  }

  const chunks: CodeChunk[] = [];

  const targetNodes = [
    'function_declaration', 'function_definition', 'method_definition', 
    'class_declaration', 'class_definition', 'impl_item', 
    'interface_declaration', 'type_alias_declaration'
  ];

  function walk(node: Parser.SyntaxNode) {
    if (targetNodes.includes(node.type) && node.text.length > 30) {
      chunks.push({
        content: node.text,
        startLine: node.startPosition.row + 1, 
        endLine: node.endPosition.row + 1
      });
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);

  return chunks.length > 0 ? chunks : naiveChunking(code);
}