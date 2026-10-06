import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { MessageSquare, Sparkles, ArrowUp, FileCode, CornerDownLeft } from 'lucide-react';

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

export function ChatPane({ messages = [], isStreaming, onSelectCitation, onSendMessage }) {
  const [inputQuery, setInputQuery] = useState('');

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
        {messages.map((msg) => (
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
        ))}
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
