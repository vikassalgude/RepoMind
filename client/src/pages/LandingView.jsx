import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Terminal, Sparkles, ArrowRight, Code2, Cpu, Database, ShieldCheck, Zap, Github, LogOut } from 'lucide-react';
import { API_URL, fetchCurrentUser, logoutUser } from '../services/api';

export function LandingView() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    fetchCurrentUser()
      .then((data) => {
        if (isMounted) {
          setCurrentUser(data?.user || null);
          setLoadingAuth(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUser(null);
          setLoadingAuth(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGitHubAuth = () => {
    window.location.href = `${API_URL}/api/auth/github`;
  };

  const handleLogout = async () => {
    await logoutUser().catch(() => {});
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#e5e5e5] flex flex-col font-['Inter'] selection:bg-white selection:text-black">
      {/* Top Navbar */}
      <header className="h-16 px-6 md:px-10 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0c0c0c]/90 backdrop-blur sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[#0c0c0c] shadow-sm">
            <Terminal size={18} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-['Hanken_Grotesk'] text-base font-bold text-white tracking-tight leading-tight">
              RepoMind
            </span>
            <span className="font-['JetBrains_Mono'] text-[9px] font-semibold tracking-wider text-[#737373] uppercase leading-tight">
              DEVELOPER SUITE
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-semibold font-['Inter'] transition-colors flex items-center gap-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={14} />
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-[#737373] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGitHubAuth}
              className="px-4 py-2 bg-white text-[#0c0c0c] rounded-xl text-xs font-semibold font-['Inter'] hover:bg-neutral-200 transition-opacity flex items-center gap-2 shadow-sm"
            >
              <Github size={14} />
              <span>Sign in with GitHub</span>
            </button>
          )}
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
        <p className="text-base sm:text-lg text-[#888888] max-w-2xl font-['Inter'] leading-relaxed mb-10">
          RepoMind indexes GitHub repositories using AST structural chunking and 3072-dim Qdrant vectors. Authenticate with GitHub to index and explore your repositories.
        </p>

        {/* Primary Call-To-Action (Authentication Gate) */}
        <div className="w-full max-w-md mb-16 flex flex-col items-center">
          {currentUser ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-4 px-6 bg-white hover:bg-neutral-200 text-black text-sm font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl font-['Inter']"
            >
              <span>Launch Developer Dashboard</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleGitHubAuth}
              className="w-full py-4 px-6 bg-white hover:bg-neutral-200 text-black text-sm font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl font-['Inter'] cursor-pointer"
            >
              <Github size={18} />
              <span>Sign in with GitHub to Access Dashboard</span>
              <ArrowRight size={16} />
            </button>
          )}

          <p className="text-xs text-[#666666] mt-3 font-['JetBrains_Mono']">
            Protected workspace • Indexing requires authenticated GitHub access
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left mt-4">
          {/* Card 1 */}
          <div className="p-6 bg-[#111111] border border-[#222222] rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-sky-400">
              <Code2 size={20} />
            </div>
            <h3 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              AST Structural Chunking
            </h3>
            <p className="text-xs text-[#888888] leading-relaxed">
              Parses source files into functions, classes, and types using <code className="text-white font-['JetBrains_Mono']">web-tree-sitter</code> rather than naive line breaks.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-[#111111] border border-[#222222] rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-emerald-400">
              <Database size={20} />
            </div>
            <h3 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              Qdrant Vector Cloud
            </h3>
            <p className="text-xs text-[#888888] leading-relaxed">
              Embeds code chunks into 3072-dimensional vector space for sub-millisecond semantic retrieval across thousands of files.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-[#111111] border border-[#222222] rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-amber-400">
              <Zap size={20} />
            </div>
            <h3 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              Exact Line Citations
            </h3>
            <p className="text-xs text-[#888888] leading-relaxed">
              Streams responses in real time with interactive citation pills that take you directly to the target source lines in the code pane.
            </p>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="mt-16 pt-8 border-t border-[#1e1e1e] w-full flex flex-wrap items-center justify-center gap-8 text-[#737373] text-xs font-['JetBrains_Mono']">
          <span className="flex items-center gap-2"><Cpu size={14} className="text-sky-400" /> Groq (llama-3.3-70b)</span>
          <span className="flex items-center gap-2"><Database size={14} className="text-emerald-400" /> Qdrant Vector Cloud</span>
          <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-purple-400" /> GitHub OAuth & Session JWT</span>
          <span className="flex items-center gap-2"><Code2 size={14} className="text-amber-400" /> Tree-Sitter AST</span>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-6 border-t border-[#1e1e1e] text-center text-xs font-['JetBrains_Mono'] text-[#555555]">
        RepoMind Developer Suite • GitHub OAuth & AST Structural RAG Memory
      </footer>
    </div>
  );
}
