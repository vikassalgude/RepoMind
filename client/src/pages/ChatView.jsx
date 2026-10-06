import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Header } from '../components/shell/Header';
import { Sidebar } from '../components/shell/Sidebar';
import { ChatPane } from '../components/shell/ChatPane';
import { CodePane } from '../components/shell/CodePane';
import { MOCK_FILES } from '../data/mockData';
import { streamChatResponse, fetchRepoStatus } from '../services/api';

const ResizeHandle = () => (
  <Separator className="w-2 relative group cursor-col-resize shrink-0 focus:outline-none">
    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[#444748] group-hover:w-1 group-hover:bg-[#585c5e] transition-all duration-150 ease-in-out z-10" />
  </Separator>
);

// Helper to extract file citations from AI response text
function parseCitationsFromText(text) {
  if (!text) return [];
  const regex = /([a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+):\s*(\d+)-(\d+)/g;
  const citations = [];
  const seen = new Set();

  let match;
  while ((match = regex.exec(text)) !== null) {
    const path = match[1];
    const startLine = parseInt(match[2], 10);
    const endLine = parseInt(match[3], 10);
    const key = `${path}:${startLine}-${endLine}`;

    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        path,
        startLine,
        endLine,
        description: `Source Citation`,
        isPrimary: citations.length === 0
      });
    }
  }
  return citations;
}

// Helper to transform raw DB chunks into line-numbered code file
function buildFileFromChunks(filePath, chunksForFile) {
  if (!chunksForFile || chunksForFile.length === 0) return null;

  const lines = [];
  chunksForFile.forEach(chunk => {
    const rawLines = (chunk.content || '').split('\n');
    rawLines.forEach((text, idx) => {
      lines.push({
        num: chunk.startLine + idx,
        text,
        type: text.trim().startsWith('//') || text.trim().startsWith('/*') ? 'comment' :
              text.trim().startsWith('import') ? 'import' :
              text.trim().startsWith('export') || text.trim().startsWith('function') ? 'function' : 'normal'
      });
    });
  });

  return {
    path: filePath,
    name: filePath.split('/').pop(),
    language: chunksForFile[0]?.language || 'TypeScript',
    chunkInfo: {
      title: `Indexed Vector Chunk`,
      dims: '3072 dims',
      score: '0.920'
    },
    lines
  };
}

export function ChatView() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const [currentRepo, setCurrentRepo] = useState({
    id: repoId || 'repomind',
    name: repoId === 'express' ? 'expressjs/express' : repoId === 'tailwind' ? 'tailwindlabs/tailwindcss' : 'vikassalgude/RepoMind',
    branch: 'main',
    chunkCount: repoId === 'express' ? 340 : 55,
    status: 'Ready'
  });

  const [dynamicFilePaths, setDynamicFilePaths] = useState([]);
  const [dbChunksMap, setDbChunksMap] = useState({});
  const [selectedFilePath, setSelectedFilePath] = useState('server/src/utils/chunker.ts');
  const [highlightLines, setHighlightLines] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Fetch Repository Data & Reset State on repoId change
  useEffect(() => {
    setMessages([]);
    setHighlightLines(null);

    if (repoId) {
      fetchRepoStatus(repoId)
        .then((data) => {
          setCurrentRepo({
            id: data.id,
            name: data.name,
            branch: data.branch || 'main',
            chunkCount: data.chunkCount || 0,
            status: data.status === 'READY' ? 'Ready' : data.status
          });

          if (data.chunks && data.chunks.length > 0) {
            const pathMap = {};
            data.chunks.forEach(chunk => {
              if (!pathMap[chunk.filePath]) {
                pathMap[chunk.filePath] = [];
              }
              pathMap[chunk.filePath].push(chunk);
            });

            const uniquePaths = Object.keys(pathMap);
            setDynamicFilePaths(uniquePaths);
            setDbChunksMap(pathMap);

            if (uniquePaths.length > 0) {
              setSelectedFilePath(uniquePaths[0]);
            }
          }
        })
        .catch((err) => {
          console.warn('[ChatView] Backend repo fetch fallback:', err.message);
        });
    }
  }, [repoId]);

  // File Selection Handler (Sidebar -> CodePane)
  const handleSelectFile = (path) => {
    setSelectedFilePath(path);
    setHighlightLines(null);
  };

  // Citation Click Handler (ChatPane -> CodePane)
  const handleSelectCitation = (path, startLine, endLine) => {
    setSelectedFilePath(path);
    setHighlightLines({ start: startLine, end: endLine });
  };

  // Chat Submission & Live SSE Streaming Handler
  const handleSendMessage = async (text) => {
    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text
    };

    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      isStreaming: true,
      citations: []
    };

    const historyPayload = messages;

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);

    await streamChatResponse({
      repoId: currentRepo.id || repoId || 'repomind',
      query: text,
      messages: historyPayload,
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== aiMsgId) return msg;
            const updatedText = msg.text + token;
            const liveCitations = parseCitationsFromText(updatedText);

            return {
              ...msg,
              text: updatedText,
              citations: liveCitations.length > 0 ? liveCitations : msg.citations
            };
          })
        );
      },
      onError: (errMessage) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  text: msg.text + `\n\n⚠️ Error: ${errMessage}`,
                  isStreaming: false
                }
              : msg
          )
        );
        setIsStreaming(false);
      },
      onComplete: () => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
        setIsStreaming(false);
      }
    });
  };

  // Resolve current active file: DB chunks -> Mock fallback
  const dbFileObj = dbChunksMap[selectedFilePath] 
    ? buildFileFromChunks(selectedFilePath, dbChunksMap[selectedFilePath])
    : null;

  const currentFile = dbFileObj || MOCK_FILES[selectedFilePath] || {
    path: selectedFilePath,
    name: selectedFilePath.split('/').pop(),
    language: 'TypeScript',
    chunkInfo: { title: 'Indexed Vector Chunk', dims: '3072 dims', score: '0.880' },
    lines: [
      { num: 1, text: `// File content for ${selectedFilePath}`, type: 'comment' },
      { num: 2, text: `export function inspect() { console.log("Inspecting ${selectedFilePath}"); }`, type: 'function' }
    ]
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131313] text-[#e5e2e1] overflow-hidden font-['Inter']">
      {/* Top Header Shell */}
      <Header
        currentRepo={currentRepo}
        activeView="explorer"
        onNavigate={(view) => {
          if (view === 'dashboard') navigate('/dashboard');
        }}
      />

      {/* Main 3-Column Workspace Shell */}
      <main className="flex-1 overflow-hidden h-[calc(100vh-53px)]">
        <Group orientation="horizontal" className="h-full w-full">
          {/* Left Column: Sidebar / File Tree */}
          <Panel defaultSize="18%" minSize="180px">
            <div className="h-full w-full overflow-hidden">
              <Sidebar 
                selectedFilePath={selectedFilePath}
                onSelectFile={handleSelectFile}
                dynamicFiles={dynamicFilePaths}
                repoBranch={currentRepo.branch}
                chunkCount={currentRepo.chunkCount}
              />
            </div>
          </Panel>

          <ResizeHandle />

          {/* Center Column: Code Viewer */}
          <Panel defaultSize="47%" minSize="320px">
            <div className="h-full w-full overflow-hidden">
              <CodePane 
                currentFile={currentFile}
                highlightLines={highlightLines}
              />
            </div>
          </Panel>

          <ResizeHandle />

          {/* Right Column: Conversation / Chat Stream */}
          <Panel defaultSize="35%" minSize="320px">
            <div className="h-full w-full overflow-hidden">
              <ChatPane 
                messages={messages}
                isStreaming={isStreaming}
                onSelectCitation={handleSelectCitation}
                onSendMessage={handleSendMessage}
              />
            </div>
          </Panel>
        </Group>
      </main>
    </div>
  );
}
