import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Folder,
  MessageSquare,
  Settings,
  LogOut,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Plus,
  Terminal,
  FolderGit2,
  Lock,
  X,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import {
  createRepository,
  fetchRepositories,
  fetchUserRepos,
  fetchCurrentUser,
  logoutUser
} from '../services/api';

// Realistic fallback repositories matching the RepoMind developer suite
const FALLBACK_REPOS = [
  {
    name: 'RepoMind',
    full_name: 'vikassalgude/RepoMind',
    description: 'AST-aware RAG codebase intelligence platform for GitHub repositories.',
    isPrivate: false,
    html_url: 'https://github.com/vikassalgude/RepoMind',
    default_branch: 'main',
    language: 'TYPESCRIPT',
    isIndexed: false,
    repoId: null,
    status: null
  },
  {
    name: 'Roxiller-store-rating',
    full_name: 'vikassalgude/Roxiller-store-rating',
    description: 'No description provided.',
    isPrivate: false,
    html_url: 'https://github.com/vikassalgude/Roxiller-store-rating',
    default_branch: 'main',
    language: 'JAVASCRIPT',
    isIndexed: false,
    repoId: null,
    status: null
  },
  {
    name: 'habit-tracker',
    full_name: 'vikassalgude/habit-tracker',
    description: 'No description provided.',
    isPrivate: false,
    html_url: 'https://github.com/vikassalgude/habit-tracker',
    default_branch: 'main',
    language: 'JAVASCRIPT',
    isIndexed: false,
    repoId: null,
    status: null
  },
  {
    name: 'wostup.ai-backend',
    full_name: 'vikassalgude/wostup.ai-backend',
    description: 'No description provided.',
    isPrivate: false,
    html_url: 'https://github.com/vikassalgude/wostup.ai-backend',
    default_branch: 'main',
    language: 'JAVASCRIPT',
    isIndexed: false,
    repoId: null,
    status: null
  },
  {
    name: 'DBMS-',
    full_name: 'vikassalgude/DBMS-',
    description: 'No description provided.',
    isPrivate: false,
    html_url: 'https://github.com/vikassalgude/DBMS-',
    default_branch: 'main',
    language: 'C++',
    isIndexed: false,
    repoId: null,
    status: null
  },
  {
    name: 'vikassalgude',
    full_name: 'vikassalgude/vikassalgude',
    description: 'Config files for my GitHub profile.',
    isPrivate: false,
    html_url: 'https://github.com/vikassalgude/vikassalgude',
    default_branch: 'main',
    language: 'UNKNOWN',
    isIndexed: false,
    repoId: null,
    status: null
  }
];

export function DashboardView() {
  const [activeNav, setActiveNav] = useState('my-repos'); // 'dashboard' | 'my-repos' | 'conversations' | 'settings'
  const [currentUser, setCurrentUser] = useState(null);
  const [userRepos, setUserRepos] = useState([]);
  const [indexedRepos, setIndexedRepos] = useState([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [indexingMap, setIndexingMap] = useState({});
  const [error, setError] = useState(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [submittingCustom, setSubmittingCustom] = useState(false);

  const navigate = useNavigate();
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    fetchCurrentUser()
      .then((data) => {
        if (isMounted) {
          if (!data || !data.user) {
            setCurrentUser(null);
            setLoadingAuth(false);
            navigate('/');
            return;
          }
          setCurrentUser(data.user);
          setLoadingAuth(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUser(null);
          setLoadingAuth(false);
          navigate('/');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const loadDashboardData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const [uRepos, iRepos] = await Promise.all([
        fetchUserRepos().catch(() => []),
        fetchRepositories().catch(() => [])
      ]);

      const freshList = (uRepos && uRepos.length > 0)
        ? uRepos
        : FALLBACK_REPOS.map((item) => {
            const matched = (iRepos || []).find(
              (idx) =>
                idx.name?.toLowerCase() === item.name.toLowerCase() ||
                idx.githubUrl?.toLowerCase() === item.html_url.toLowerCase()
            );
            if (matched) {
              return {
                ...item,
                isIndexed: true,
                repoId: matched.id,
                status: matched.status
              };
            }
            return item;
          });

      setUserRepos((prev) => {
        const prevKey = JSON.stringify((prev || []).map(r => ({ id: r.repoId, s: r.status, name: r.full_name || r.name })));
        const nextKey = JSON.stringify((freshList || []).map(r => ({ id: r.repoId, s: r.status, name: r.full_name || r.name })));
        return prevKey === nextKey ? prev : freshList;
      });

      setIndexedRepos((prev) => {
        const prevKey = JSON.stringify((prev || []).map(r => ({ id: r.id, s: r.status })));
        const nextKey = JSON.stringify((iRepos || []).map(r => ({ id: r.id, s: r.status })));
        return prevKey === nextKey ? prev : (iRepos || []);
      });
    } catch (err) {
      console.warn('[Dashboard Data Sync Warning]:', err.message);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!loadingAuth && currentUser) {
      loadDashboardData();
    }
  }, [loadingAuth, currentUser]);

  useEffect(() => {
    const isAnyIndexing =
      userRepos.some((r) => r.status === 'INDEXING' || r.status === 'QUEUED') ||
      Object.values(indexingMap).some(Boolean);

    if (!isAnyIndexing) return;

    const interval = setInterval(() => {
      loadDashboardData();
    }, 4000);

    return () => clearInterval(interval);
  }, [userRepos, indexingMap]);

  const handleIndexRepo = async (htmlUrl, repoName) => {
    setError(null);
    setIndexingMap((prev) => ({ ...prev, [htmlUrl]: true }));

    setUserRepos((prev) =>
      prev.map((r) =>
        r.html_url === htmlUrl || (repoName && (r.full_name === repoName || r.name === repoName))
          ? { ...r, isIndexed: true, status: 'QUEUED' }
          : r
      )
    );

    try {
      await createRepository(htmlUrl);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || `Failed to index repository ${repoName || ''}`);
    } finally {
      setIndexingMap((prev) => ({ ...prev, [htmlUrl]: false }));
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!customRepoUrl.trim()) return;
    setSubmittingCustom(true);
    setError(null);
    try {
      await createRepository(customRepoUrl.trim());
      setShowCustomModal(false);
      setCustomRepoUrl('');
      await loadDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to index custom repository.');
    } finally {
      setSubmittingCustom(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setCurrentUser(null);
    navigate('/');
  };

  // Derive user display name & initials
  const rawName = currentUser?.username || (currentUser?.email ? currentUser.email.split('@')[0] : 'Vikassalgude04');
  const userDisplayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initials = (rawName.slice(0, 2) || 'VI').toUpperCase();

  const displayRepos = userRepos.length > 0 ? userRepos : FALLBACK_REPOS;

  if (loadingAuth) {
    return (
      <div className="h-screen bg-[#0c0c0c] flex items-center justify-center font-['Inter']">
        <div className="flex items-center gap-3 text-xs font-mono text-[#888888]">
          <RefreshCw size={16} className="animate-spin text-white" />
          <span>Verifying GitHub session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#0c0c0c] text-[#e5e5e5] font-['Inter'] selection:bg-white selection:text-black overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="w-60 md:w-64 border-r border-[#1e1e1e] bg-[#0c0c0c] flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col">
          {/* Logo Header: Click redirects to home page */}
          <Link
            to="/"
            className="h-20 px-6 flex items-center gap-3 hover:opacity-90 transition-opacity"
            title="Go to RepoMind Home"
          >
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold shadow-sm">
              <Terminal size={17} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-['Hanken_Grotesk'] text-[15px] font-bold text-white tracking-tight leading-tight">
                RepoMind
              </span>
              <span className="font-['JetBrains_Mono'] text-[9px] font-semibold tracking-wider text-[#737373] uppercase leading-tight mt-0.5">
                DEVELOPER SUITE
              </span>
            </div>
          </Link>

          {/* Primary Navigation Menu */}
          <nav className="px-3 py-2 space-y-1">
            <button
              onClick={() => activeNav !== 'dashboard' && setActiveNav('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeNav === 'dashboard'
                  ? 'bg-[#1c1c1c] text-white border border-[#2a2a2a]'
                  : 'text-[#888888] hover:text-white hover:bg-[#161616]'
              }`}
            >
              <LayoutDashboard size={16} className="shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => activeNav !== 'my-repos' && setActiveNav('my-repos')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeNav === 'my-repos'
                  ? 'bg-[#1c1c1c] text-white border border-[#2a2a2a]'
                  : 'text-[#888888] hover:text-white hover:bg-[#161616]'
              }`}
            >
              <Folder size={16} className="shrink-0" />
              <span>My repos</span>
            </button>

            <button
              onClick={() => activeNav !== 'conversations' && setActiveNav('conversations')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeNav === 'conversations'
                  ? 'bg-[#1c1c1c] text-white border border-[#2a2a2a]'
                  : 'text-[#888888] hover:text-white hover:bg-[#161616]'
              }`}
            >
              <MessageSquare size={16} className="shrink-0" />
              <span>Conversations</span>
            </button>
          </nav>
        </div>

        {/* Bottom Secondary Navigation */}
        <div className="px-3 py-4 border-t border-[#1a1a1a] space-y-1">
          <button
            onClick={() => activeNav !== 'settings' && setActiveNav('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              activeNav === 'settings'
                ? 'bg-[#1c1c1c] text-white border border-[#2a2a2a]'
                : 'text-[#888888] hover:text-white hover:bg-[#161616]'
            }`}
          >
            <Settings size={16} className="shrink-0" />
            <span>Settings</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#888888] hover:text-red-400 hover:bg-[#161616] transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#0a0a0a]">
        {/* Top Header Bar */}
        <header className="h-16 px-8 md:px-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Context breadcrumb or space */}
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-3">
            <span className="text-xs md:text-sm font-medium text-[#d4d4d4]">
              {userDisplayName}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#333333] flex items-center justify-center text-xs font-bold text-white uppercase select-none">
              {initials}
            </div>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-8 md:mx-10 mb-4 p-3.5 bg-red-950/40 border border-red-800/40 text-red-300 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:text-white text-red-400"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* MAIN BODY CONTENT */}
        <main className="flex-1 px-8 md:px-10 pb-16">
          {/* TAB 1: MY REPOS */}
          {activeNav === 'my-repos' && (
            <div className="max-w-5xl">
              {/* Header Titles */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl md:text-[28px] font-bold text-white tracking-tight font-['Hanken_Grotesk']">
                    Import GitHub Repository
                  </h1>
                  <p className="text-xs md:text-sm text-[#737373] mt-1 font-['Inter']">
                    Select and index any of your GitHub repositories with one click
                  </p>
                </div>

                {/* Import Custom Repo Button */}
                <button
                  onClick={() => setShowCustomModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#141414] hover:bg-[#1d1d1d] border border-[#262626] hover:border-[#383838] text-xs font-medium text-[#a3a3a3] hover:text-white rounded-xl transition-colors self-start sm:self-auto"
                >
                  <Plus size={14} />
                  <span>Custom URL</span>
                </button>
              </div>

              {/* 2-Column Repository Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                {displayRepos.map((repo, idx) => {
                  const isPrivate = repo.private === true || repo.isPrivate === true;
                  const isCurrentIndexing = Boolean(indexingMap[repo.html_url]);
                  const isReady =
                    repo.isIndexed && (repo.status === 'READY' || repo.status === 'Ready');
                  const isProcessing =
                    ((repo.isIndexed &&
                      (repo.status === 'QUEUED' || repo.status === 'INDEXING')) ||
                    isCurrentIndexing) &&
                    !isReady;
                  const isFailed =
                    repo.isIndexed &&
                    (repo.status === 'FAILED' || repo.status === 'Failed') &&
                    !isCurrentIndexing;

                  const cardKey = repo.html_url || repo.full_name || repo.name || idx;

                  return (
                    <div
                      key={cardKey}
                      className="bg-[#111111] border border-[#222222] hover:border-[#2f2f2f] rounded-2xl p-5 md:p-6 flex flex-col justify-between transition-colors min-h-[178px]"
                    >
                      {/* Top Row: Repo Title + Status Badges + PUBLIC/PRIVATE badge */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderGit2
                              size={16}
                              className="text-[#999999] shrink-0 stroke-[1.8]"
                            />
                            <a
                              href={repo.html_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-xs md:text-sm text-white hover:text-neutral-300 transition-colors truncate"
                            >
                              {repo.full_name || repo.name}
                            </a>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isProcessing && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium text-amber-400 bg-amber-950/40 border border-amber-800/40">
                                <RefreshCw size={10} className="animate-spin text-amber-400" />
                                <span>Indexing in progress...</span>
                              </span>
                            )}
                            {isReady && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Ready</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium text-rose-400 bg-rose-950/40 border border-rose-800/40">
                                <AlertCircle size={10} className="text-rose-400" />
                                <span>Indexing Failed</span>
                              </span>
                            )}
                            <span className="shrink-0 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-[#737373] bg-[#1a1a1a] border border-[#2a2a2a] uppercase font-semibold">
                              {isPrivate ? 'PRIVATE' : 'PUBLIC'}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-[#737373] mt-2 line-clamp-2 leading-relaxed">
                          {repo.description || 'No description provided.'}
                        </p>

                        {/* Language Tag */}
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-[#737373] font-semibold uppercase">
                          <span className="text-[#888888]">&lt;&gt;</span>
                          <span>{repo.language || 'UNKNOWN'}</span>
                        </div>
                      </div>

                      {/* Bottom Button */}
                      <div className="mt-5">
                        {isPrivate ? (
                          <button
                            disabled
                            className="w-full py-2.5 px-4 bg-[#161616] border border-[#2a2a2a] text-[#737373] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 opacity-60 cursor-not-allowed select-none"
                          >
                            <Lock size={13} className="text-[#737373]" />
                            <span>Private Repos Disabled</span>
                          </button>
                        ) : isReady ? (
                          <button
                            onClick={() => navigate(`/chat/${repo.repoId || repo.id}`)}
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/50 hover:shadow-emerald-900/40"
                          >
                            <MessageSquare size={13} className="text-white" />
                            <span>Chat & Explore</span>
                          </button>
                        ) : isProcessing ? (
                          <button
                            disabled
                            className="w-full py-2.5 px-4 bg-[#161616] border border-amber-500/30 text-amber-400/90 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
                          >
                            <RefreshCw size={13} className="animate-spin text-amber-400" />
                            <span>Indexing in progress...</span>
                          </button>
                        ) : isFailed ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 py-2.5 px-3.5 bg-rose-950/30 border border-rose-800/40 text-rose-400 text-xs font-medium rounded-xl flex items-center gap-2">
                              <AlertCircle size={13} className="text-rose-400 shrink-0" />
                              <span className="truncate">Indexing Failed</span>
                            </div>
                            <button
                              onClick={() => handleIndexRepo(repo.html_url, repo.name)}
                              className="py-2.5 px-4 bg-[#161616] hover:bg-rose-950/50 border border-rose-700/50 hover:border-rose-600 text-rose-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
                            >
                              <RefreshCw size={12} className="shrink-0" />
                              <span>Retry</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleIndexRepo(repo.html_url, repo.name)}
                            className="w-full py-2.5 px-4 bg-[#161616] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-[#383838] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                          >
                            <Search size={13} className="text-[#a3a3a3]" />
                            <span>Index Repository</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DASHBOARD OVERVIEW */}
          {activeNav === 'dashboard' && (
            <div className="max-w-5xl space-y-8">
              <div>
                <h1 className="text-2xl md:text-[28px] font-bold text-white tracking-tight font-['Hanken_Grotesk']">
                  Workspace Overview
                </h1>
                <p className="text-xs md:text-sm text-[#737373] mt-1 font-['Inter']">
                  Monitor indexed repository clusters and active vector databases
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5">
                  <span className="text-[11px] font-mono text-[#737373] uppercase tracking-wider">
                    Total Repositories
                  </span>
                  <div className="text-2xl font-bold text-white mt-2">
                    {displayRepos.length}
                  </div>
                </div>

                <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5">
                  <span className="text-[11px] font-mono text-[#737373] uppercase tracking-wider">
                    Indexed & Ready
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 mt-2">
                    {indexedRepos.filter((r) => r.status === 'Ready' || r.status === 'READY').length}
                  </div>
                </div>

                <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5">
                  <span className="text-[11px] font-mono text-[#737373] uppercase tracking-wider">
                    Vector Memory
                  </span>
                  <div className="text-2xl font-bold text-white mt-2">
                    AST Structural
                  </div>
                </div>
              </div>

              {/* Indexed Repos List */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider font-mono">
                  Indexed Knowledge Repositories
                </h2>

                <div className="border border-[#222222] rounded-2xl overflow-hidden bg-[#111111] divide-y divide-[#1e1e1e]">
                  {indexedRepos.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-[#737373]">
                      No repositories have been indexed yet. Head to "My repos" to index one.
                    </div>
                  ) : (
                    indexedRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-[#161616] transition-colors"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white font-mono">
                            {repo.name}
                          </div>
                          <div className="text-xs text-[#737373] mt-0.5">
                            {repo.chunkCount || 0} AST Chunks • {repo.branch || 'main'}
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/chat/${repo.id}`)}
                          className="px-4 py-2 bg-white text-black hover:bg-white/90 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <MessageSquare size={13} />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONVERSATIONS */}
          {activeNav === 'conversations' && (
            <div className="max-w-5xl space-y-6">
              <div>
                <h1 className="text-2xl md:text-[28px] font-bold text-white tracking-tight font-['Hanken_Grotesk']">
                  Conversations
                </h1>
                <p className="text-xs md:text-sm text-[#737373] mt-1 font-['Inter']">
                  Access active chat sessions and AST-augmented discussions
                </p>
              </div>

              <div className="border border-[#222222] rounded-2xl overflow-hidden bg-[#111111] divide-y divide-[#1e1e1e]">
                {indexedRepos.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-[#737373]">
                    No active conversations found. Index a repository to initiate an AI chat.
                  </div>
                ) : (
                  indexedRepos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => navigate(`/chat/${repo.id}`)}
                      className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-[#161616] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-white">
                          <MessageSquare size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            Chat on {repo.name}
                          </div>
                          <div className="text-xs text-[#737373]">
                            Persistent RAG memory enabled
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-[#888888] font-mono flex items-center gap-1">
                        <span>Open</span>
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeNav === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-2xl md:text-[28px] font-bold text-white tracking-tight font-['Hanken_Grotesk']">
                  Settings
                </h1>
                <p className="text-xs md:text-sm text-[#737373] mt-1 font-['Inter']">
                  Manage your developer suite preferences and authentication
                </p>
              </div>

              <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-5">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-[#737373] block mb-1">
                    Connected Profile
                  </label>
                  <div className="text-sm text-white font-medium">
                    {currentUser?.email || 'vikassalgude04@gmail.com'}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1e1e1e]">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#737373] block mb-1">
                    LLM Engine & Embeddings
                  </label>
                  <div className="text-xs text-[#a3a3a3]">
                    Groq Llama-3.3-70b-versatile + Gemini AST Structural RAG
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1e1e1e] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Sign out</div>
                    <div className="text-xs text-[#737373]">
                      End active session on this device
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-950/40 border border-red-800/50 hover:bg-red-900/40 text-red-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CUSTOM REPO URL MODAL */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white font-['Hanken_Grotesk']">
                Index GitHub Repository
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#888888] mb-4">
              Provide any public or authorized repository URL (e.g.{' '}
              <code className="text-neutral-300">https://github.com/owner/repo</code>)
            </p>

            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <input
                type="text"
                value={customRepoUrl}
                onChange={(e) => setCustomRepoUrl(e.target.value)}
                placeholder="https://github.com/facebook/react"
                disabled={submittingCustom}
                className="w-full bg-[#181818] border border-[#2c2c2c] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-[#666666] focus:outline-none focus:border-white transition-colors"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#888888] hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCustom || !customRepoUrl.trim()}
                  className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {submittingCustom ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Indexing...</span>
                    </>
                  ) : (
                    <>
                      <span>Index & Chat</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
