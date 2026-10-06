import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Terminal, GitBranch, Layers, MessageSquare, Plus, ArrowRight, CheckCircle2, Clock, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { createRepository, fetchRepositories, fetchRepoStatus } from '../services/api';

export function DashboardView() {
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repos, setRepos] = useState([
    {
      id: 'repomind',
      name: 'vikassalgude/RepoMind',
      branch: 'feat/ingestion-pipeline',
      chunks: 55,
      status: 'Ready',
      updatedAt: '10 minutes ago'
    },
    {
      id: 'express',
      name: 'expressjs/express',
      branch: 'main',
      chunks: 340,
      status: 'Ready',
      updatedAt: '2 hours ago'
    },
    {
      id: 'react',
      name: 'facebook/react',
      branch: 'main',
      chunks: 820,
      status: 'Indexing (65%)',
      updatedAt: 'In progress...'
    },
    {
      id: 'tailwind',
      name: 'tailwindlabs/tailwindcss',
      branch: 'main',
      chunks: 410,
      status: 'Ready',
      updatedAt: 'Yesterday'
    }
  ]);

  const navigate = useNavigate();

  // Load repositories from backend API
  const loadBackendRepos = async () => {
    try {
      const backendRepos = await fetchRepositories();
      if (backendRepos && backendRepos.length > 0) {
        setRepos(backendRepos.map(r => ({
          id: r.id,
          name: r.name,
          branch: r.branch || 'main',
          chunks: r.chunkCount || 0,
          status: r.status === 'READY' ? 'Ready' : r.status === 'QUEUED' ? 'Queued' : r.status === 'INDEXING' ? 'Indexing (65%)' : r.status,
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString() : 'Recently'
        })));
      }
    } catch (err) {
      // Keep static mock data if backend connection fails
      console.warn('[Dashboard] Could not connect to backend API, using fallback mock list:', err.message);
    }
  };

  useEffect(() => {
    loadBackendRepos();

    // Setup 5-second polling interval for live status updates
    const pollInterval = setInterval(() => {
      loadBackendRepos();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleAnalyzeNew = async (e) => {
    e?.preventDefault();
    if (!newRepoUrl.trim()) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createRepository(newRepoUrl.trim());
      setNewRepoUrl('');
      
      // Reload repos to show newly queued repo
      await loadBackendRepos();

      // Navigate to explorer for the new repo
      if (result.repoId) {
        navigate(`/chat/${result.repoId}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze repository. Please check the URL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalChunks = repos.reduce((sum, r) => sum + (r.chunks || 0), 0);

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] flex flex-col font-['Inter']">
      {/* Dashboard Top Header */}
      <header className="h-14 px-6 border-b border-[#444748] flex items-center justify-between bg-[#131313] shrink-0 select-none">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded flex items-center justify-center text-[#131313]">
              <Terminal size={18} className="stroke-[2.5]" />
            </div>
            <span className="font-['Hanken_Grotesk'] text-lg font-bold text-white tracking-tight">
              RepoMind
            </span>
          </Link>
          <div className="h-4 w-[1px] bg-[#444748]" />
          <span className="text-xs font-['JetBrains_Mono'] text-[#8e9192]">
            Workspace Dashboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/chat/repomind"
            className="px-3 py-1.5 bg-white text-[#131313] rounded-md text-xs font-semibold hover:bg-white/90 transition-opacity flex items-center gap-1.5"
          >
            <span>Open Explorer</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-[#1c1b1b] border border-[#444748] rounded-2xl">
          <div>
            <h1 className="text-2xl font-bold font-['Hanken_Grotesk'] text-white flex items-center gap-2">
              <span>Welcome to RepoMind</span>
              <Sparkles size={18} className="text-emerald-400" />
            </h1>
            <p className="text-xs sm:text-sm text-[#c4c7c8] mt-1 font-['Inter']">
              Analyze, inspect structural AST chunks, and query your indexed GitHub repositories.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 bg-[#1c1b1b] border border-[#444748] rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-['JetBrains_Mono'] text-[#8e9192] uppercase font-semibold">Indexed Repos</div>
              <div className="text-2xl font-bold text-white font-['Hanken_Grotesk'] mt-1">{repos.length}</div>
            </div>
            <div className="w-10 h-10 bg-[#2a2a2a] border border-[#444748] rounded-lg flex items-center justify-center text-emerald-400">
              <GitBranch size={20} />
            </div>
          </div>

          <div className="p-5 bg-[#1c1b1b] border border-[#444748] rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-['JetBrains_Mono'] text-[#8e9192] uppercase font-semibold">Total Chunks</div>
              <div className="text-2xl font-bold text-white font-['Hanken_Grotesk'] mt-1">{totalChunks.toLocaleString()}</div>
            </div>
            <div className="w-10 h-10 bg-[#2a2a2a] border border-[#444748] rounded-lg flex items-center justify-center text-sky-400">
              <Layers size={20} />
            </div>
          </div>

          <div className="p-5 bg-[#1c1b1b] border border-[#444748] rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-['JetBrains_Mono'] text-[#8e9192] uppercase font-semibold">Questions Answered</div>
              <div className="text-2xl font-bold text-white font-['Hanken_Grotesk'] mt-1">182</div>
            </div>
            <div className="w-10 h-10 bg-[#2a2a2a] border border-[#444748] rounded-lg flex items-center justify-center text-amber-400">
              <MessageSquare size={20} />
            </div>
          </div>
        </div>

        {/* Analyze New Repo Form Card */}
        <div className="p-6 bg-[#1c1b1b] border border-[#444748] rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-white" />
            <h2 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              Analyze a new GitHub Repository
            </h2>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2 font-['Inter']">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAnalyzeNew} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newRepoUrl}
              onChange={(e) => setNewRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/facebook/react"
              disabled={isSubmitting}
              className="flex-1 bg-[#131313] border border-[#444748] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-['Inter'] text-[#e5e2e1] focus:outline-none focus:border-[#8e9192] placeholder:text-[#8e9192]/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newRepoUrl.trim()}
              className="px-5 py-2.5 bg-white text-[#131313] font-semibold text-xs sm:text-sm rounded-xl hover:bg-white/90 disabled:opacity-40 transition-opacity shrink-0 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Analyze & Index</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Recently Indexed Repositories List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white font-['Hanken_Grotesk']">
              Recently Indexed Repositories
            </h2>
            <span className="text-xs font-['JetBrains_Mono'] text-[#8e9192]">{repos.length} total</span>
          </div>

          <div className="border border-[#444748] rounded-xl overflow-hidden bg-[#1c1b1b]/50 divide-y divide-[#444748]/50">
            {repos.map((repo) => {
              const isReady = repo.status === 'Ready' || repo.status === 'READY';

              return (
                <div key={repo.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1c1b1b] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-['JetBrains_Mono'] text-sm font-semibold text-white">
                        {repo.name}
                      </span>
                      <span className="px-2 py-0.5 bg-[#2a2a2a] border border-[#444748] rounded text-[10px] font-['JetBrains_Mono'] text-[#8e9192] flex items-center gap-1">
                        <GitBranch size={10} />
                        {repo.branch}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#8e9192] font-['Inter']">
                      <span>{repo.chunks} AST Chunks</span>
                      <span>•</span>
                      <span>Updated {repo.updatedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Status Badge */}
                    {isReady ? (
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[11px] font-['JetBrains_Mono'] font-medium flex items-center gap-1.5">
                        <CheckCircle2 size={12} />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[11px] font-['JetBrains_Mono'] font-medium flex items-center gap-1.5">
                        <Clock size={12} className="animate-spin" />
                        <span>{repo.status}</span>
                      </span>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={() => navigate(`/chat/${repo.id}`)}
                      className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#353535] border border-[#444748] text-white rounded-lg text-xs font-['JetBrains_Mono'] transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare size={13} className="text-sky-400" />
                      <span>Chat & Explore</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
