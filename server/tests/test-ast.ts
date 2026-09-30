import { generateASTChunks } from '../src/utils/chunker';

const tsCode = `
import express from 'express';

interface UserConfig {
  name: string;
  email: string;
  age: number;
}

type ResponseType = 'json' | 'xml' | 'csv';

function createServer(port: number): void {
  const app = express();
  app.listen(port, () => {
    console.log('Server running on port ' + port);
  });
}

class DatabaseService {
  private connectionString: string;

  constructor(connStr: string) {
    this.connectionString = connStr;
  }

  async connect(): Promise<void> {
    console.log('Connecting to ' + this.connectionString);
  }

  async query(sql: string): Promise<any[]> {
    return [];
  }
}

export function helperUtil(input: string): string {
  return input.trim().toLowerCase();
}
`;

const tsxCode = `
import React, { useState, useEffect } from 'react';

interface Props {
  title: string;
  count: number;
}

function Dashboard({ title, count }: Props) {
  const [data, setData] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div className="dashboard">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <ul>
        {data.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

export default Dashboard;
`;

async function runTests() {
  console.log('='.repeat(60));
  console.log('TEST 1: TypeScript (.ts) AST Chunking');
  console.log('='.repeat(60));

  const tsChunks = await generateASTChunks(tsCode, 'TYPESCRIPT');
  console.log(`\nGenerated ${tsChunks.length} AST chunks:\n`);
  tsChunks.forEach((chunk, i) => {
    console.log(`--- Chunk ${i + 1} [Lines ${chunk.startLine}-${chunk.endLine}] ---`);
    console.log(chunk.content.substring(0, 120) + (chunk.content.length > 120 ? '...' : ''));
    console.log('');
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: TSX (.tsx) AST Chunking');
  console.log('='.repeat(60));

  const tsxChunks = await generateASTChunks(tsxCode, 'TYPESCRIPT');
  console.log(`\nGenerated ${tsxChunks.length} AST chunks:\n`);
  tsxChunks.forEach((chunk, i) => {
    console.log(`--- Chunk ${i + 1} [Lines ${chunk.startLine}-${chunk.endLine}] ---`);
    console.log(chunk.content.substring(0, 120) + (chunk.content.length > 120 ? '...' : ''));
    console.log('');
  });

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`TypeScript (.ts):  ${tsChunks.length} semantic chunks extracted`);
  console.log(`TSX (.tsx):        ${tsxChunks.length} semantic chunks extracted`);
  console.log(`AST Engine:        ${tsChunks.length > 0 ? 'WORKING' : 'FALLING BACK TO NAIVE'}`);
}

runTests().catch(console.error);
