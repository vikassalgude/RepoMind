import React from 'react';
import { Terminal, GitBranch, ArrowLeft } from 'lucide-react';

export function Header({ currentRepo, activeView, onNavigate }) {
  return (
    <header className="flex justify-between items-center h-14 px-4 w-full border-b border-[#444748] bg-[#131313] z-20 shrink-0 select-none">
      <div className="flex items-center gap-5">
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate && onNavigate('dashboard')}
        >
          <div className="w-7 h-7 bg-white rounded flex items-center justify-center text-[#131313]">
            <Terminal size={18} className="stroke-[2.5]" />
          </div>
          <span className="font-['Hanken_Grotesk'] text-lg font-bold text-white tracking-tight">
            RepoMind
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#444748]" />

        {/* Selected Repo Badge */}
        {currentRepo ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#1c1b1b] border border-[#444748] rounded-md text-xs font-['JetBrains_Mono'] text-[#e5e2e1]">
              <GitBranch size={14} className="text-[#8e9192]" />
              <span>{currentRepo.name || currentRepo.githubUrl}</span>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-['JetBrains_Mono'] font-bold text-emerald-400 uppercase tracking-widest">
                {currentRepo.chunkCount || 55} Chunks · {currentRepo.status || 'Ready'}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs font-['JetBrains_Mono'] text-[#8e9192]">
            Repository Intelligence Platform
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {activeView === 'explorer' && (
          <button
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#444748] hover:bg-[#2a2a2a] transition-colors text-[#e5e2e1] rounded-md text-xs font-['JetBrains_Mono']"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
        )}
      </div>
    </header>
  );
}
