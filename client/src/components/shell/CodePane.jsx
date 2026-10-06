import React, { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, MoreVertical, Sparkles, Copy, Check, ChevronRight, ExternalLink } from 'lucide-react';

function getLanguageFromPath(path = '') {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'py':
      return 'python';
    case 'md':
      return 'markdown';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'sql':
      return 'sql';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    default:
      return 'typescript';
  }
}

export function CodePane({ currentFile, highlightLines }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const [copied, setCopied] = useState(false);

  // Derive plain code text string from currentFile
  const codeText = currentFile?.lines
    ? currentFile.lines.map((l) => l.text).join('\n')
    : currentFile?.content || '// No code content available';

  const language = getLanguageFromPath(currentFile?.path);
  const breadcrumbs = (currentFile?.path || 'server/src/utils/chunker.ts').split('/');

  // Monaco Editor mount handler
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyCitationHighlight(editor, monaco, highlightLines);
  };

  // Re-apply citation line highlights & scroll whenever highlightLines or file changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      applyCitationHighlight(editorRef.current, monacoRef.current, highlightLines);
    }
  }, [highlightLines, currentFile]);

  function applyCitationHighlight(editor, monaco, lines) {
    if (!lines || !lines.start) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }

    const start = Math.max(1, lines.start);
    const end = lines.end ? Math.max(start, lines.end) : start;

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(start, 1, end, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-citation-highlight'
        }
      }
    ]);

    // Smooth scroll target line into center of editor viewport
    editor.revealLineInCenter(start, 1);
  }

  // Copy code handler
  const handleCopyCode = () => {
    if (!codeText) return;
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!currentFile) {
    return (
      <section className="w-full h-full flex flex-col items-center justify-center bg-[#0e0e0e] text-[#8e9192]">
        <FileCode size={32} className="mb-2 opacity-40" />
        <p className="text-xs font-['Inter']">Select a file to view code</p>
      </section>
    );
  }

  return (
    <section className="w-full h-full flex flex-col bg-[#0e0e0e] overflow-hidden border-r border-[#444748]/30">
      {/* Pane Header with Breadcrumbs */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-[#444748] bg-[#0e0e0e]/95 shrink-0 select-none">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs font-['JetBrains_Mono'] text-[#c4c7c8] truncate max-w-[65%]">
          <FileCode size={15} className="text-sky-400 shrink-0 mr-1" />
          {breadcrumbs.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight size={12} className="text-[#8e9192]/60 shrink-0" />}
              <span className={index === breadcrumbs.length - 1 ? "font-semibold text-white truncate" : "text-[#8e9192] shrink-0"}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {highlightLines ? (
            <span className="px-2 py-0.5 bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded text-[11px] font-['JetBrains_Mono'] font-medium flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              Lines {highlightLines.start}-{highlightLines.end}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-[#2a2a2a] border border-[#444748] rounded text-[11px] font-['JetBrains_Mono'] text-[#8e9192] font-medium">
              {currentFile.lines?.length || 0} lines
            </span>
          )}

          {/* Copy Button */}
          <button 
            onClick={handleCopyCode}
            title="Copy code" 
            className="flex items-center gap-1.5 px-2 py-1 bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#444748] rounded transition-colors text-xs text-[#c4c7c8] hover:text-white font-['JetBrains_Mono']"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>

          <button title="Options" className="p-1.5 hover:bg-[#2a2a2a] rounded transition-colors text-[#8e9192] hover:text-white">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Monaco Editor Canvas */}
      <div className="flex-1 w-full h-full bg-[#0e0e0e] overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={codeText}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbersMinChars: 4,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'none',
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            }
          }}
        />
      </div>

      {/* Code Insight / Vector Metadata Toolbar */}
      <div className="h-14 border-t border-[#444748] bg-[#1c1b1b] px-4 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-sky-500/10 border border-sky-500/20 rounded-md flex items-center justify-center text-sky-400">
            <Sparkles size={14} />
          </div>
          <div>
            <div className="text-xs font-semibold text-white font-['Hanken_Grotesk'] flex items-center gap-2">
              <span>{currentFile.chunkInfo?.title || 'Indexed AST Chunk'}</span>
              <span className="text-[10px] font-['JetBrains_Mono'] text-[#8e9192] bg-[#2a2a2a] px-1.5 py-0.5 rounded">
                {currentFile.chunkInfo?.dims || '3072 dims'}
              </span>
            </div>
            <div className="text-[11px] text-[#8e9192] font-['Inter']">
              Indexed in Qdrant Cloud • Score: {currentFile.chunkInfo?.score || '0.910'}
            </div>
          </div>
        </div>

        <button className="flex items-center gap-1 text-[11px] text-sky-400 font-['JetBrains_Mono'] hover:underline">
          <span>View payload</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </section>
  );
}
