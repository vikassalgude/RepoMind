import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Terminal, Sparkles, ArrowRight, Code2, Cpu, Database, Search, ShieldCheck, Zap } from 'lucide-react';

export function LandingView() {
  const [repoUrl, setRepoUrl] = useState('');
  const navigate = useNavigate();

  const handleAnalyze = (e) => {
    e?.preventDefault();
    // Navigate to dashboard
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] flex flex-col font-['Inter'] selection:bg-white selection:text-black">
      {/* Top Navbar */}
      <header className="h-16 px-8 border-b border-[#444748] flex items-center justify-between bg-[#131313]/90 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#131313]">
            <Terminal size={20} className="stroke-[2.5]" />
          </div>
          <span className="font-['Hanken_Grotesk'] text-xl font-bold text-white tracking-tight">
            RepoMind
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-xs font-['JetBrains_Mono'] text-[#c4c7c8] hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-white text-[#131313] rounded-lg text-xs font-semibold font-['Inter'] hover:bg-white/90 transition-opacity"
          >
            Analyze Repository
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-5xl mx-auto text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-['JetBrains_Mono'] font-medium mb-8">
          <Sparkles size={14} className="text-emerald-400" />
          <span>AST-AWARE RAG FOR GITHUB REPOSITORIES</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-['Hanken_Grotesk'] text-white tracking-tight leading-[1.15] max-w-3xl mb-6">
          Deep AI Intelligence for Your Entire Codebase
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#c4c7c8] max-w-2xl font-['Inter'] leading-relaxed mb-10">
          RepoMind indexes GitHub repositories using AST structural chunking and 3072-dim Qdrant vectors. Ask questions and stream answers with exact line citations.
        </p>

        {/* Analyze Input CTA Form */}
        <form onSubmit={handleAnalyze} className="w-full max-w-xl mb-16">
          <div className="p-1.5 bg-[#1c1b1b] border border-[#444748] focus-within:border-[#8e9192] rounded-2xl flex items-center shadow-xl transition-all">
            <div className="pl-3.5 pr-2 text-[#8e9192]">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Paste GitHub URL (e.g. https://github.com/expressjs/express)"
              className="w-full bg-transparent border-none py-3 text-xs sm:text-sm font-['Inter'] text-[#e5e2e1] focus:outline-none placeholder:text-[#8e9192]/60"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-white text-[#131313] font-semibold text-xs sm:text-sm rounded-xl hover:bg-white/90 transition-opacity shrink-0 flex items-center gap-2 font-['Inter']"
            >
              <span>Analyze</span>
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-[11px] font-['JetBrains_Mono'] text-[#8e9192]">
            <span>Try: vikassalgude/RepoMind</span>
            <span>•</span>
            <span>No Auth Required</span>
          </div>
        </form>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mt-4">
          {/* Card 1 */}
          <div className="p-6 bg-[#1c1b1b]/60 border border-[#444748] rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-[#2a2a2a] border border-[#444748] rounded-xl flex items-center justify-center text-sky-400">
              <Code2 size={20} />
            </div>
            <h3 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              AST Structural Chunking
            </h3>
            <p className="text-xs text-[#c4c7c8] leading-relaxed">
              Parses source files into functions, classes, and types using <code className="text-white font-['JetBrains_Mono']">web-tree-sitter</code> rather than naive line breaks.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-[#1c1b1b]/60 border border-[#444748] rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-[#2a2a2a] border border-[#444748] rounded-xl flex items-center justify-center text-emerald-400">
              <Database size={20} />
            </div>
            <h3 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              Qdrant Vector Cloud
            </h3>
            <p className="text-xs text-[#c4c7c8] leading-relaxed">
              Embeds code chunks into 3072-dimensional vector space for sub-millisecond semantic retrieval across thousands of files.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-[#1c1b1b]/60 border border-[#444748] rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-[#2a2a2a] border border-[#444748] rounded-xl flex items-center justify-center text-amber-400">
              <Zap size={20} />
            </div>
            <h3 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              Exact Line Citations
            </h3>
            <p className="text-xs text-[#c4c7c8] leading-relaxed">
              Streams responses in real time with interactive citation pills that take you directly to the target source lines in the code pane.
            </p>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="mt-16 pt-8 border-t border-[#444748]/40 w-full flex flex-wrap items-center justify-center gap-8 text-[#8e9192] text-xs font-['JetBrains_Mono']">
          <span className="flex items-center gap-2"><Cpu size={14} className="text-sky-400" /> Gemini 1.5 Pro</span>
          <span className="flex items-center gap-2"><Database size={14} className="text-emerald-400" /> Qdrant Vector DB</span>
          <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-purple-400" /> Supabase Postgres</span>
          <span className="flex items-center gap-2"><Code2 size={14} className="text-amber-400" /> Tree-Sitter AST</span>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-6 border-t border-[#444748] text-center text-xs font-['JetBrains_Mono'] text-[#8e9192]">
        RepoMind RAG System • Built for GitHub Ingestion & Exploration
      </footer>
    </div>
  );
}
