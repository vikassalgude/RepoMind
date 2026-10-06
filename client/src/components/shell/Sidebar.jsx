import React, { useState, useMemo } from 'react';
import { 
  Search, 
  FolderOpen, 
  Folder, 
  FileCode, 
  FileText, 
  Package, 
  Database, 
  GitBranch, 
  Layers,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const DEFAULT_FALLBACK_PATHS = [
  'server/src/utils/chunker.ts',
  'server/src/workers/ingestionWorker.ts',
  'server/src/server.ts',
  'package.json'
];

/**
 * Utility: Converts a flat array of file paths into a nested tree data structure.
 * e.g., ['server/src/utils/chunker.ts'] -> [{ name: 'server', isDir: true, children: [...] }]
 */
function buildNestedTree(filePaths) {
  const root = [];

  filePaths.forEach((path) => {
    const parts = path.split('/');
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          fullPath: isFile ? path : parts.slice(0, index + 1).join('/'),
          isDir: !isFile,
          children: []
        };
        currentLevel.push(existingNode);
      }
      currentLevel = existingNode.children;
    });
  });

  // Sort directories first, then files alphabetically
  function sortNodes(nodes) {
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.isDir) sortNodes(node.children);
    });
    return nodes;
  }

  return sortNodes(root);
}

// File icon selector helper
function getFileIcon(fileName, isSelected) {
  if (fileName.endsWith('.json')) return <Package size={14} className="text-orange-400 shrink-0" />;
  if (fileName.endsWith('.md')) return <FileText size={14} className="text-slate-400 shrink-0" />;
  if (fileName.endsWith('.sql') || fileName.endsWith('.prisma')) return <Database size={14} className="text-purple-400 shrink-0" />;
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <FileCode size={14} className={isSelected ? "text-sky-400 shrink-0" : "text-sky-400/90 shrink-0"} />;
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <FileCode size={14} className="text-amber-400 shrink-0" />;
  return <FileCode size={14} className={isSelected ? "text-sky-400 shrink-0" : "text-emerald-400 shrink-0"} />;
}

/**
 * Recursive File Tree Node Component: Renders collapsible folders & files
 */
function FileTreeNode({ node, selectedFilePath, onSelectFile, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(true);

  if (node.isDir) {
    return (
      <div className="space-y-0.5">
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 8 + 4}px` }}
          className="flex items-center gap-1.5 py-1 px-1 hover:bg-[#1c1b1b] rounded cursor-pointer text-[#e5e2e1] transition-colors font-medium select-none text-xs"
        >
          {isOpen ? (
            <ChevronDown size={14} className="text-[#8e9192] shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-[#8e9192] shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen size={14} className="text-amber-400 shrink-0" />
          ) : (
            <Folder size={14} className="text-amber-400/80 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </div>

        {isOpen && (
          <div className="border-l border-[#444748]/30 ml-2 space-y-0.5">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.fullPath || child.name}
                node={child}
                selectedFilePath={selectedFilePath}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File Leaf Node
  const isSelected = selectedFilePath === node.fullPath;
  return (
    <div
      onClick={() => onSelectFile?.(node.fullPath)}
      style={{ paddingLeft: `${depth * 8 + 6}px` }}
      className={`flex items-center justify-between py-1 pr-2 rounded cursor-pointer transition-colors text-xs ${
        isSelected 
          ? 'bg-[#2a2a2a] text-white font-medium border-l-2 border-sky-400' 
          : 'hover:bg-[#1c1b1b] text-[#c4c7c8]'
      }`}
      title={node.fullPath}
    >
      <div className="flex items-center gap-2 truncate">
        {getFileIcon(node.name, isSelected)}
        <span className="truncate">{node.name}</span>
      </div>
      {isSelected && (
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>
      )}
    </div>
  );
}

export function Sidebar({ selectedFilePath, onSelectFile, dynamicFiles = [], repoBranch = 'main', chunkCount = 55 }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Use dynamic files from backend if present, else fallback demo paths
  const activeFilePaths = dynamicFiles.length > 0 ? dynamicFiles : DEFAULT_FALLBACK_PATHS;

  // Filter paths by search input
  const filteredPaths = useMemo(() => {
    if (!searchTerm.trim()) return activeFilePaths;
    return activeFilePaths.filter(path => 
      path.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeFilePaths, searchTerm]);

  // Convert flat paths into nested tree hierarchy
  const treeData = useMemo(() => {
    return buildNestedTree(filteredPaths);
  }, [filteredPaths]);

  return (
    <aside className="w-full flex flex-col bg-[#0e0e0e] shrink-0 select-none h-full border-r border-[#444748]/30">
      {/* Search Bar */}
      <div className="p-3 border-b border-[#444748]/40">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e9192]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search repository files..."
            className="w-full bg-[#1c1b1b] border border-[#444748] rounded-md py-1.5 pl-8 pr-3 text-xs font-['Inter'] text-[#e5e2e1] focus:outline-none focus:border-[#8e9192] transition-colors placeholder:text-[#8e9192]/50"
          />
        </div>
      </div>

      {/* Explorer Section Header */}
      <div className="px-3 py-2 border-b border-[#444748]/20 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-['JetBrains_Mono'] text-[#8e9192] uppercase tracking-widest font-semibold">
          <ChevronDown size={12} className="text-[#8e9192]" />
          <span>Explorer</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-['JetBrains_Mono'] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
          <GitBranch size={10} />
          <span>{repoBranch}</span>
        </div>
      </div>

      {/* Nested File Tree Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5 text-xs font-['Inter']">
        {treeData.length > 0 ? (
          treeData.map((node) => (
            <FileTreeNode
              key={node.fullPath || node.name}
              node={node}
              selectedFilePath={selectedFilePath}
              onSelectFile={onSelectFile}
            />
          ))
        ) : (
          <div className="p-3 text-center text-xs text-[#8e9192]">
            No files match "{searchTerm}"
          </div>
        )}
      </div>

      {/* Indexing Stats Footer */}
      <div className="p-3 border-t border-[#444748]/30 bg-[#131313]/60">
        <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-[#8e9192]">
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-emerald-400" />
            <span>{chunkCount} Chunks</span>
          </div>
          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
            Qdrant Ready
          </span>
        </div>
      </div>
    </aside>
  );
}
