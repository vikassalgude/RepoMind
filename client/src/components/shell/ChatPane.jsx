import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { MessageSquare, Sparkles, ArrowUp, FileCode, CornerDownLeft, AlertCircle, ArrowLeft } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
  suppressErrorRendering: true
});

if (typeof mermaid.parseError === 'function') {
  mermaid.parseError = () => {};
}

// Auto-sanitize and repair LLM Mermaid syntax mistakes before rendering
function sanitizeMermaidChart(rawChart) {
  if (!rawChart) return '';

  let cleaned = rawChart
    .replace(/[\u202F\u00A0]/g, ' ')
    .replace(/[\u2011]/g, '-');

  const lines = cleaned.split('\n').map((line) => {
    let l = line;
    // Strip inline comments if they appear on the same line after node definitions
    if (l.includes('%%') && !l.trim().startsWith('%%')) {
      l = l.split('%%')[0];
    }

    // Auto-quote unquoted node labels for common shapes:
    // 1. Database shape: [( ... )]
    l = l.replace(/([A-Za-z0-9_]+)\[\(\s*(?!"|\s*")([^)]+?)\s*\)\]/g, '$1[("$2")]');
    // 2. Parallelogram shapes: [/ ... /] or [\ ... \]
    l = l.replace(/([A-Za-z0-9_]+)\[\/\s*(?!"|\s*")([^\/]+?)\s*\/\]/g, '$1[/"$2"/]');
    l = l.replace(/([A-Za-z0-9_]+)\[\\\s*(?!"|\s*")([^\\]+?)\s*\\\]/g, '$1[\\"$2"\\]');
    // 3. Round-rect / stadium shapes: ([ ... ])
    l = l.replace(/([A-Za-z0-9_]+)\(\[\s*(?!"|\s*")([^\]]+?)\s*\]\)/g, '$1(["$2"])');
    // 4. Rectangular shapes: [ ... ]
    l = l.replace(/([A-Za-z0-9_]+)\[\s*(?!"|\s*")([^\]]+?)\s*\]/g, '$1["$2"]');
    // 5. Rounded shapes: ( ... )
    l = l.replace(/([A-Za-z0-9_]+)\(\s*(?!"|\s*")([^)]+?)\s*\)/g, '$1("$2")');
    // 6. Rhombus shapes: { ... }
    l = l.replace(/([A-Za-z0-9_]+)\{\s*(?!"|\s*")([^}]+?)\s*\}/g, '$1{"$2"}');

    return l;
  });

  return lines.join('\n');
}

function MermaidDiagram({ chart }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const renderCount = useRef(0);

  const sanitizedChart = useMemo(() => sanitizeMermaidChart(chart), [chart]);

  useEffect(() => {
    let isMounted = true;
    if (!sanitizedChart || !sanitizedChart.trim()) return;

    renderCount.current += 1;
    const uniqueId = `mermaid-${Date.now()}-${renderCount.current}-${Math.random().toString(36).substring(2, 7)}`;

    const renderSvg = async () => {
      try {
        if (typeof mermaid.parse === 'function') {
          const isValid = await mermaid.parse(sanitizedChart).catch(() => false);
          if (!isValid) {
            if (isMounted) setError(true);
            return;
          }
        }
        const { svg: renderedSvg } = await mermaid.render(uniqueId, sanitizedChart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
        }
      } finally {
        // Clean up orphan elements inserted by Mermaid into document body
        const orphanErrors = document.querySelectorAll(`[id^="d${uniqueId}"], #d${uniqueId}, .error-icon`);
        orphanErrors.forEach((el) => el.remove());
      }
    };

    renderSvg();

    return () => {
      isMounted = false;
      const el = document.getElementById(uniqueId);
      if (el) el.remove();
      const orphanErrors = document.querySelectorAll(`[id^="d${uniqueId}"], #d${uniqueId}`);
      orphanErrors.forEach((node) => node.remove());
    };
  }, [sanitizedChart]);

  if (error) {
    return (
      <div className="my-3 p-3 bg-[#1c1b1b] border border-[#444748] rounded-xl font-['JetBrains_Mono'] text-xs text-[#8e9192] overflow-x-auto">
        <div className="text-amber-400 text-xs mb-1.5 font-semibold flex items-center gap-1.5 font-['Inter']">
          <span>⚠️</span> Diagram syntax error
        </div>
        <pre className="block bg-[#131313] p-3 rounded-lg border border-[#444748] font-['JetBrains_Mono'] text-xs overflow-x-auto text-[#e5e2e1]">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 p-3 bg-[#131313] border border-[#444748] rounded-xl font-['JetBrains_Mono'] text-xs text-[#8e9192] overflow-x-auto">
        <div className="text-sky-400 text-[11px] mb-1.5 font-semibold flex items-center gap-1.5 font-['Inter']">
          <Sparkles size={12} /> Rendering diagram...
        </div>
        <pre className="block bg-[#131313] p-3 rounded-lg border border-[#444748] font-['JetBrains_Mono'] text-xs overflow-x-auto text-[#e5e2e1]">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className="my-3 p-4 bg-[#0e0e0e] border border-[#444748] rounded-xl overflow-x-auto flex justify-center shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function ChatPane({
  messages = [],
  isStreaming,
  loadingHistory = false,
  repoName = '',
  repoStatus = '',
  onSelectCitation,
  onSendMessage
}) {
  const navigate = useNavigate();
  const [inputQuery, setInputQuery] = useState('');
  const isFailed = repoStatus === 'FAILED' || repoStatus === 'Failed';

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputQuery.trim()) return;
    onSendMessage?.(inputQuery.trim());
    setInputQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Helper to process inline text for file citations: path/to/file:startLine-endLine
  const renderInlineCitationsInText = (text, keyPrefix) => {
    if (typeof text !== 'string') return text;
    const parts = [];
    const regex = /([a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+):(\d+)-(\d+)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }
      const [full, path, startLine, endLine] = match;
      parts.push(
        <span
          key={`${keyPrefix}-cite-${match.index}`}
          onClick={() => onSelectCitation?.(path, parseInt(startLine, 10), parseInt(endLine, 10))}
          className="inline-flex items-center gap-1 px-1.5 py-0 mx-1 text-xs bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded cursor-pointer align-baseline font-mono hover:bg-sky-500/20 hover:border-sky-500/50 transition-colors"
        >
          <FileCode size={11} className="shrink-0" />
          {full}
        </span>
      );
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <section className="w-full h-full flex flex-col bg-[#131313] overflow-hidden">
      {/* Pane Header */}
      <div className="h-12 flex items-center justify-between px-5 border-b border-[#444748] bg-[#0e0e0e]/40 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[#8e9192]" />
          <span className="font-['Hanken_Grotesk'] text-sm font-semibold text-white">
            Conversation
          </span>
          <span className="ml-2 text-[11px] font-['JetBrains_Mono'] text-[#8e9192]">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-['JetBrains_Mono'] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Groq RAG Stream
          </span>
        </div>
      </div>

      {/* Chat Messages Stream Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 select-text">
        {/* Indexing Failed Warning Banner */}
        {isFailed && (
          <div className="w-full p-4 bg-rose-950/40 border border-rose-800/50 rounded-2xl text-rose-200">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <h4 className="text-xs font-semibold text-rose-200 uppercase tracking-wider font-mono">
                  Repository Indexing Failed
                </h4>
                <p className="text-xs text-rose-300/80 leading-relaxed font-['Inter']">
                  We were unable to complete indexing for this repository. Return to the dashboard to retry indexing.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800/80 border border-rose-700/60 text-white rounded-xl text-xs font-medium transition-colors"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to Dashboard</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loadingHistory ? (
          /* Subtle Pulse / Skeleton Loader while conversation messages hydrate */
          <div className="h-full flex flex-col justify-center max-w-md mx-auto space-y-5 animate-pulse p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#222222]" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 bg-[#222222] rounded w-2/5" />
                <div className="h-2.5 bg-[#1a1a1a] rounded w-3/5" />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="h-3.5 bg-[#1c1c1c] rounded w-full" />
              <div className="h-3.5 bg-[#1c1c1c] rounded w-11/12" />
              <div className="h-3.5 bg-[#1c1c1c] rounded w-4/5" />
            </div>
            <div className="pt-4 space-y-2.5">
              <div className="h-10 bg-[#191919] rounded-xl w-full" />
              <div className="h-10 bg-[#191919] rounded-xl w-5/6" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* Clean Developer Greeting & Empty State with Suggestion Pills */
          <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center px-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-lg shadow-sky-500/5">
              <Sparkles size={22} />
            </div>

            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight font-['Hanken_Grotesk']">
              Chat with {repoName || 'Repository'}
            </h2>

            <p className="text-xs md:text-sm text-[#8e9192] mt-1.5 max-w-sm font-['Inter'] leading-relaxed">
              Ask questions, explore architecture, or trace data flows.
            </p>

            <div className="mt-8 w-full flex flex-col gap-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#737373] text-left px-1">
                Suggested prompts
              </span>
              {[
                'Explain the high-level architecture',
                'Trace the main API routes',
                'What are the core dependencies?'
              ].map((pillText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputQuery(pillText)}
                  className="w-full text-left p-3 rounded-xl bg-[#1c1b1b] hover:bg-[#252525] border border-[#333333] hover:border-[#4f4f4f] text-xs text-[#d4d4d4] hover:text-white transition-all flex items-center justify-between group"
                >
                  <span className="truncate">{pillText}</span>
                  <CornerDownLeft
                    size={13}
                    className="text-[#737373] group-hover:text-white shrink-0 ml-2 transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
          <React.Fragment key={msg.id}>
            {/* User Message Bubble */}
            {msg.sender === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-[#2a2a2a] border border-[#444748] rounded-2xl px-4 py-3 text-sm text-[#e5e2e1] shadow-sm font-['Inter'] whitespace-pre-wrap select-text">
                  {msg.text}
                </div>
              </div>
            )}

            {/* AI Response Card with Markdown */}
            {msg.sender === 'ai' && (
              <div className="flex flex-col items-start gap-3 select-text">
                {/* AI Header */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-tr from-sky-400 to-indigo-500 rounded-md flex items-center justify-center text-white shadow-sm">
                    <Sparkles size={13} />
                  </div>
                  <span className="font-['JetBrains_Mono'] text-xs text-white font-bold tracking-wider">
                    RepoMind AI
                  </span>
                  <span className="text-[10px] text-[#8e9192] font-['JetBrains_Mono']">Just now</span>
                </div>

                {/* AI Markdown Content */}
                <div className="w-full text-[#c4c7c8] leading-relaxed space-y-3.5 text-sm font-['Inter'] bg-[#1c1b1b]/50 border border-[#444748]/50 rounded-2xl p-4 select-text">
                  <div className="text-sm space-y-2 font-['Inter'] leading-relaxed select-text">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, children, ...props }) => {
                          const formattedChildren = React.Children.map(children, (child, idx) =>
                            renderInlineCitationsInText(child, `p-${idx}`)
                          );
                          return <p className="mb-2 leading-relaxed select-text" {...props}>{formattedChildren}</p>;
                        },
                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 my-2 select-text" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 my-2 select-text" {...props} />,
                        code: ({ node, inline, className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const language = match ? match[1] : '';
                          const content = String(children);
                          const isInline = inline !== undefined ? inline : (!className && !content.includes('\n'));

                          if (!isInline && language === 'mermaid') {
                            return <MermaidDiagram chart={content.trim()} />;
                          }

                          const citationMatch = /^([a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+):(\d+)-(\d+)$/.exec(content.trim());
                          if (citationMatch) {
                            const [, path, startLine, endLine] = citationMatch;
                            return (
                              <span
                                onClick={() => onSelectCitation?.(path, parseInt(startLine, 10), parseInt(endLine, 10))}
                                className="inline-flex items-center gap-1 px-1.5 py-0 mx-1 text-xs bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded cursor-pointer align-baseline font-mono hover:bg-sky-500/20 hover:border-sky-500/50 transition-colors"
                              >
                                <FileCode size={11} className="shrink-0" />
                                {content.trim()}
                              </span>
                            );
                          }

                          if (isInline) {
                            return (
                              <code className="bg-[#2a2a2a] text-sky-300 px-1 py-0.5 mx-0.5 rounded text-[13px] font-mono break-words" {...props}>
                                {children}
                              </code>
                            );
                          }

                          return (
                            <code className="block bg-[#131313] p-3 rounded-lg border border-[#444748] font-['JetBrains_Mono'] text-xs overflow-x-auto my-2 text-[#e5e2e1]" {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.text || (msg.isStreaming ? '' : 'No response text received.')}
                    </ReactMarkdown>

                    {msg.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-sky-400 ml-1 animate-pulse rounded-sm align-middle" />
                    )}
                  </div>

                  {msg.supportedLanguages && (
                    <div className="space-y-1 text-xs pt-2">
                      <div className="text-white font-semibold font-['Hanken_Grotesk']">Supported Languages:</div>
                      <ul className="list-disc pl-5 space-y-1 text-[#c4c7c8]">
                        {msg.supportedLanguages.map((lang, idx) => (
                          <li key={idx}>{lang}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Citations List Footer */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 space-y-2 border-t border-[#444748]/40 mt-3">
                      <div className="text-[11px] font-['JetBrains_Mono'] text-[#8e9192] uppercase tracking-wider font-semibold">
                        Retrieved Context & Sources ({msg.citations.length})
                      </div>

                      <div className="grid gap-2">
                        {msg.citations.map((cite, idx) => (
                          <div 
                            key={idx}
                            onClick={() => onSelectCitation?.(cite.path, cite.startLine, cite.endLine)}
                            className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all group ${
                              cite.isPrimary
                                ? 'bg-sky-500/5 border border-sky-500/30 hover:bg-sky-500/10 hover:border-sky-500/50'
                                : 'bg-[#1c1b1b] border border-[#444748] hover:border-[#8e9192] hover:bg-[#2a2a2a]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <FileCode size={16} className={`${cite.isPrimary ? 'text-sky-400' : 'text-emerald-400'} group-hover:scale-110 transition-transform`} />
                              <div>
                                <div className="text-xs font-semibold text-white font-['JetBrains_Mono']">
                                  {cite.path}
                                </div>
                                <div className="text-[11px] text-[#8e9192]">{cite.description}</div>
                              </div>
                            </div>
                            <span className={`text-[11px] font-['JetBrains_Mono'] font-medium px-2 py-0.5 rounded border ${
                              cite.isPrimary
                                ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                                : 'text-[#8e9192] bg-[#2a2a2a] border-[#444748]'
                            }`}>
                              Lines {cite.startLine}-{cite.endLine}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </React.Fragment>
        )))}
      </div>

      {/* Sticky Query Input Box */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[#444748] bg-[#0e0e0e] shrink-0">
        <div className="relative max-w-3xl mx-auto">
          <textarea
            rows={2}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this repository codebase..."
            className="w-full bg-[#1c1b1b] border border-[#444748] rounded-xl pt-3 pb-3 pl-4 pr-12 text-sm font-['Inter'] text-[#e5e2e1] focus:outline-none focus:border-[#8e9192] transition-all resize-none placeholder:text-[#8e9192]/50"
          />
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[10px] font-['JetBrains_Mono'] text-[#8e9192]/60 flex items-center gap-1">
              <CornerDownLeft size={10} /> Press Enter to send
            </span>
            <button 
              type="submit"
              disabled={!inputQuery.trim() || isStreaming}
              className="p-2 bg-white text-[#131313] rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:hover:bg-white transition-opacity font-semibold flex items-center justify-center"
            >
              <ArrowUp size={16} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
