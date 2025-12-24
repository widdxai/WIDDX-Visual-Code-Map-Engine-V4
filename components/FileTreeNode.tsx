
import React, { useState, useMemo } from 'react';
import { 
  File, ChevronRight, FileJson, FileCode2,
  Folder, FolderOpen, Trash2, Edit2, Check, X,
  FileType, Settings, Image, Database, Code2, Box,
  Loader2, Sparkles, Terminal
} from 'lucide-react';
import { WiddxNode, WiddxNodeType } from '../types';

interface FileTreeNodeProps {
    node: WiddxNode;
    allNodes: WiddxNode[];
    depth: number;
    selectedId: string | null;
    onSelect: (id: string) => void;
    expandedFolders: Set<string>;
    toggleFolder: (id: string) => void;
    onDelete: (id: string) => void;
    onRename?: (oldPath: string, newPath: string) => void;
    aiProcessingId?: string | null;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  node, allNodes, depth, selectedId, onSelect, expandedFolders, toggleFolder, onDelete, onRename, aiProcessingId
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);

  const isFolder = node.type === WiddxNodeType.FOLDER;
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedId === node.id;
  const isAiProcessing = aiProcessingId === node.id;

  const children = useMemo(() => {
      if (!isFolder) return [];
      return allNodes.filter(n => n.parentId === node.id).sort((a, b) => {
          if (a.type === WiddxNodeType.FOLDER && b.type !== WiddxNodeType.FOLDER) return -1;
          if (a.type !== WiddxNodeType.FOLDER && b.type === WiddxNodeType.FOLDER) return 1;
          return a.name.localeCompare(b.name);
      });
  }, [allNodes, node.id, isFolder]);

  const handleRenameSubmit = (e?: React.FormEvent) => {
      e?.stopPropagation();
      if (renameValue && renameValue !== node.name && onRename) {
          const parent = (node.parentId === '/' || !node.parentId) ? '' : node.parentId;
          const newPath = `${parent}/${renameValue}`;
          onRename(node.id, newPath);
      }
      setIsRenaming(false);
  };

  const getIcon = () => {
      if (isAiProcessing) return <Loader2 size={14} className="text-purple-400 animate-spin" />;
      if (isFolder) {
          if (['src', 'components', 'app', 'api', 'lib', 'utils'].includes(node.name.toLowerCase())) {
             return isExpanded ? <FolderOpen size={14} className="text-emerald-400" /> : <Folder size={14} className="text-emerald-500/80" />;
          }
          if (['dist', 'build', '.git', 'node_modules'].includes(node.name.toLowerCase())) {
             return isExpanded ? <FolderOpen size={14} className="text-zinc-500" /> : <Folder size={14} className="text-zinc-600" />;
          }
          return isExpanded ? <FolderOpen size={14} className="text-purple-300" /> : <Folder size={14} className="text-purple-400/80" />;
      }
      const lower = node.name.toLowerCase();
      if (lower === 'manifest.json') return <Settings size={14} className="text-orange-400" />;
      if (lower.includes('config') || lower.startsWith('.')) return <Settings size={14} className="text-zinc-400" />;
      if (lower === 'package.json') return <Box size={14} className="text-red-400" />;
      if (lower.endsWith('.json')) return <FileJson size={14} className="text-yellow-500" />;
      if (lower.endsWith('.tsx')) return <FileCode2 size={14} className="text-purple-400" />;
      if (lower.endsWith('.ts')) return <FileCode2 size={14} className="text-blue-500" />;
      if (lower.endsWith('.jsx')) return <Code2 size={14} className="text-yellow-300" />;
      if (lower.endsWith('.js') || lower.endsWith('.mjs')) return <Code2 size={14} className="text-yellow-400" />;
      if (lower.endsWith('.py')) return <Database size={14} className="text-blue-300" />;
      if (lower.endsWith('.css') || lower.endsWith('.scss')) return <FileType size={14} className="text-sky-300" />;
      if (lower.match(/\.(png|jpg|svg|ico)$/)) return <Image size={14} className="text-pink-400" />;
      if (lower.endsWith('.sh') || lower === 'dockerfile') return <Terminal size={14} className="text-zinc-300" />;
      return <File size={14} className="text-zinc-500" />;
  };

  return (
    <div className="select-none font-sans text-[13px] relative">
       <div 
         className={`
           group flex items-center gap-1.5 py-1 pr-2 cursor-pointer transition-colors relative border-l-2
           ${isSelected ? 'bg-purple-500/10 text-white border-purple-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024] border-transparent'}
           ${isAiProcessing ? 'bg-purple-500/10 border-purple-500' : ''}
         `}
         style={{ paddingLeft: `${depth * 14 + 8}px` }}
         onClick={(e) => { e.stopPropagation(); isFolder ? toggleFolder(node.id) : onSelect(node.id); }}
         onMouseEnter={() => setIsHovered(true)}
         onMouseLeave={() => setIsHovered(false)}
       >
          <span className="shrink-0 flex items-center justify-center w-4 h-4 text-zinc-500">
             {isFolder && <ChevronRight size={12} strokeWidth={2} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} />}
          </span>

          <span className="shrink-0 opacity-90">{getIcon()}</span>
          
          <div className="flex-1 min-w-0 flex items-center gap-2">
              {isRenaming ? (
                  <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                      <input 
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="bg-[#121212] border border-purple-500 text-xs text-white px-1 py-0.5 rounded w-full focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setIsRenaming(false); }}
                      />
                  </div>
              ) : (
                  <>
                    <span className={`truncate leading-none ${isSelected ? 'font-medium' : ''} ${isAiProcessing ? 'text-purple-300' : ''}`}>{node.name}</span>
                    {isAiProcessing && <Sparkles size={10} className="text-purple-400 animate-pulse ml-auto" />}
                  </>
              )}
          </div>
          
          {isHovered && !isFolder && !isRenaming && !isAiProcessing && (
              <div className="flex items-center gap-1 bg-[#18181b] shadow-sm ml-auto animate-in fade-in zoom-in duration-100">
                  <button onClick={(e) => { e.stopPropagation(); setRenameValue(node.name); setIsRenaming(true); }} className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-purple-400 rounded"><Edit2 size={10} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-1 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 rounded"><Trash2 size={10} /></button>
              </div>
          )}
       </div>
       
       {isFolder && isExpanded && (
           <div className="relative">
             {/* Guide Line */}
             <div className="absolute w-px bg-zinc-800/40 bottom-0 top-0 pointer-events-none group-hover:bg-zinc-700 transition-colors" style={{ left: `${depth * 14 + 15}px` }} />
             <div>
                   {children.length > 0 ? (
                       children.map(child => (
                           <FileTreeNode 
                               key={child.id} node={child} allNodes={allNodes} depth={depth + 1} 
                               selectedId={selectedId} onSelect={onSelect} expandedFolders={expandedFolders}
                               toggleFolder={toggleFolder} onDelete={onDelete} onRename={onRename} aiProcessingId={aiProcessingId}
                           />
                       ))
                   ) : (
                       <div style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }} className="py-1 text-[11px] text-zinc-600 italic">Empty</div>
                   )}
             </div>
           </div>
       )}
    </div>
  );
};
