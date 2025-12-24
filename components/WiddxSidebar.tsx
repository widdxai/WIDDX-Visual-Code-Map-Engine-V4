
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Code, Plus, 
  Search, ListTree, X, Workflow, ShieldAlert, FileCode,
  Settings, Download, LogOut, AlertTriangle, 
  ChevronRight, MoreVertical, FolderOpen, PanelLeftClose, PanelLeft,
  HelpCircle, Layers, Box, Braces, Globe
} from 'lucide-react';
import { WiddxGraph, WiddxNodeType, WiddxSymbol } from '../types';
import { FileTreeNode } from './FileTreeNode';
import { WiddxCicdPanel } from './WiddxCicdPanel';
import { WiddxDiagnosticsPanel } from './WiddxDiagnosticsPanel';
import { Language, translations } from '../services/i18n';

interface WiddxSidebarProps {
  data: WiddxGraph;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateFile: (path: string, content: string) => void;
  onDeleteFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onReset: () => void;
  onExport: () => void;
  lang: Language;
  onToggleLang: () => void;
  onToggleSettings: () => void;
  onToggleGuide: () => void;
  aiProcessingNodeId?: string | null; 
  onAiProcessing?: (id: string | null) => void; 
  onRunAudit?: () => void;
  onSelectSymbol?: (fileId: string, line: number) => void;
}

type TabId = 'explorer' | 'search' | 'diagnostics' | 'cicd';

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;

export const WiddxSidebar: React.FC<WiddxSidebarProps> = ({ 
  data, selectedNodeId, onSelectNode, onUpdateFile, onDeleteFile, onCreateFile, onRenameFile, onReset, onExport, lang,
  onToggleLang, onToggleSettings, onToggleGuide, aiProcessingNodeId, onAiProcessing, onRunAudit, onSelectSymbol
}) => {
  const [activeTab, setActiveTab] = useState<TabId | null>('explorer');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  
  const [newPath, setNewPath] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(data.widdxMeta.defaultOpenFolders));
  const [searchTerm, setSearchTerm] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  
  const t = translations[lang];
  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);
  const issueCount = data.errors.length + data.conflicts.length + data.warnings.length;

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode?.type === WiddxNodeType.MISSING) {
        setNewPath(selectedNode.id.replace('MISSING:', ''));
        setActiveTab('explorer'); 
    }
  }, [selectedNodeId, selectedNode]);

  const startResizing = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
  }, []);

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isResizing) return;
          let newWidth = lang === 'ar' ? (window.innerWidth - e.clientX) - 52 : e.clientX - 52;
          if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
          if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
          setSidebarWidth(newWidth);
      };
      const handleMouseUp = () => setIsResizing(false);

      if (isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none'; 
      } else {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      };
  }, [isResizing, lang]);

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const handleCreate = () => {
    if (newPath) {
        onCreateFile(newPath);
        setNewPath('');
        setSearchTerm(''); 
    }
  };

  const handleResetClick = () => {
      if (resetConfirm) {
          onReset();
          setResetConfirm(false);
      } else {
          setResetConfirm(true);
          setTimeout(() => setResetConfirm(false), 3000);
      }
  };

  const toggleTab = (id: TabId) => {
      setActiveTab(activeTab === id ? null : id);
  };

  const renderFileExplorer = () => {
      if (searchTerm) {
          const fileMatches = data.nodes.filter(n => n.type === WiddxNodeType.FILE && n.name.toLowerCase().includes(searchTerm.toLowerCase()));
          
          const symbolMatches: WiddxSymbol[] = [];
          if (data.index?.symbols) {
              data.index.symbols.forEach((syms) => {
                  syms.forEach(sym => {
                      if (sym.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                          symbolMatches.push(sym);
                      }
                  });
              });
          }

          return (
              <div className="flex flex-col gap-1 p-2">
                  {fileMatches.map(node => (
                      <div 
                        key={node.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 rounded-md text-xs text-zinc-300 group transition-all"
                        onClick={() => onSelectNode(node.id)}
                      >
                          <FileCode size={14} className="text-purple-400" />
                          <span className="truncate font-medium">{node.name}</span>
                          <span className="truncate text-[9px] text-zinc-600 ml-auto">{node.parentId}</span>
                      </div>
                  ))}

                  {symbolMatches.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 px-2 mt-3 mb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            <Braces size={12} /> Symbols ({symbolMatches.length})
                        </div>
                        {symbolMatches.slice(0, 50).map((sym, idx) => {
                            const Icon = sym.kind === 'component' ? Box : sym.kind === 'function' ? Code : Braces;
                            const color = sym.kind === 'component' ? 'text-orange-400' : sym.kind === 'function' ? 'text-purple-400' : 'text-zinc-400';
                            
                            return (
                                <div 
                                    key={`${sym.fileId}-${sym.name}-${idx}`}
                                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 rounded-md text-xs text-zinc-400 group transition-all"
                                    onClick={() => onSelectSymbol?.(sym.fileId, sym.line)}
                                >
                                    <Icon size={12} className={color} />
                                    <span className="truncate font-mono">{sym.name}</span>
                                    <span className="truncate text-[9px] text-zinc-600 ml-auto flex items-center gap-1">
                                        {sym.fileId.split('/').pop()} <span className="bg-zinc-800 px-1 rounded text-zinc-500">:{sym.line}</span>
                                    </span>
                                </div>
                            );
                        })}
                        {symbolMatches.length > 50 && <div className="px-3 py-2 text-[10px] text-zinc-600 text-center font-mono">...and {symbolMatches.length - 50} more</div>}
                      </>
                  )}
                  
                  {fileMatches.length === 0 && symbolMatches.length === 0 && (
                      <div className="text-center py-8 text-zinc-500 text-xs">No matching files or symbols found.</div>
                  )}
              </div>
          );
      }

      const roots = data.nodes.filter(n => n.parentId === '/').sort((a,b) => {
          if (a.type === WiddxNodeType.FOLDER && b.type !== WiddxNodeType.FOLDER) return -1;
          if (a.type !== WiddxNodeType.FOLDER && b.type === WiddxNodeType.FOLDER) return 1;
          return a.name.localeCompare(b.name);
      });

      return (
          <div className="flex flex-col pb-4">
              {roots.map(node => (
                  <FileTreeNode
                      key={node.id}
                      node={node}
                      allNodes={data.nodes}
                      depth={0}
                      selectedId={selectedNodeId}
                      onSelect={onSelectNode}
                      expandedFolders={expandedFolders}
                      toggleFolder={toggleFolder}
                      onDelete={onDeleteFile}
                      onRename={onRenameFile}
                      aiProcessingId={aiProcessingNodeId}
                  />
              ))}
          </div>
      );
  };

  const ActivityIcon = ({ id, icon: Icon, badge }: { id: TabId, icon: any, badge?: number }) => (
      <button
          onClick={() => toggleTab(id)}
          className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 group mb-1 ${
              activeTab === id 
              ? 'text-white' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title={id.toUpperCase()}
      >
          {activeTab === id && <div className="absolute left-0 top-2 bottom-2 w-1 bg-purple-600 rounded-r-full" />}
          <Icon size={22} strokeWidth={1.5} className={activeTab === id ? "drop-shadow-md" : ""} />
          {badge ? (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-600 text-[7px] font-bold text-white flex items-center justify-center rounded-full border border-[#121212]">
                  {badge > 9 ? '•' : badge}
              </span>
          ) : null}
      </button>
  );

  return (
    <div className="h-full flex flex-row shrink-0 z-40 bg-[#121212] relative">
        {/* --- ACTIVITY BAR --- */}
        <div className="w-12 flex flex-col items-center justify-between bg-[#121212] border-r border-zinc-800/60 z-50 shrink-0 py-3">
            <div className="flex flex-col w-full items-center">
                <ActivityIcon id="explorer" icon={FolderOpen} />
                <ActivityIcon id="search" icon={Search} />
                <ActivityIcon id="diagnostics" icon={ShieldAlert} badge={issueCount > 0 ? issueCount : undefined} />
                <div className="w-6 h-px bg-zinc-800 my-2 opacity-50"></div>
                <ActivityIcon id="cicd" icon={Workflow} />
            </div>
            
            <div className="flex flex-col w-full items-center gap-2">
                 <button onClick={onExport} className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50" title={t.export_zip}>
                    <Download size={20} strokeWidth={1.5} />
                </button>
                 <button onClick={onToggleLang} className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50" title={lang === 'en' ? "العربية" : "English"}>
                    <Globe size={20} strokeWidth={1.5} />
                </button>
                 <button onClick={onToggleGuide} className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-zinc-800/50" title={t.ui_guide}>
                    <HelpCircle size={20} strokeWidth={1.5} />
                </button>
                <button onClick={onToggleSettings} className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50" title={t.settings}>
                    <Settings size={20} strokeWidth={1.5} />
                </button>
                <button onClick={handleResetClick} className={`w-10 h-10 flex items-center justify-center transition-colors rounded-lg hover:bg-zinc-800/50 ${resetConfirm ? 'text-red-500 animate-pulse' : 'text-zinc-500 hover:text-red-400'}`} title={t.reset}>
                   {resetConfirm ? <AlertTriangle size={20} /> : <LogOut size={20} strokeWidth={1.5} />}
                </button>
            </div>
        </div>

        {/* --- SIDEBAR PANEL --- */}
        <div 
            ref={sidebarRef}
            style={{ width: activeTab ? sidebarWidth : 0 }}
            className={`flex flex-col bg-[#18181b] border-r border-zinc-800/60 overflow-hidden relative
                ${isResizing ? '' : 'transition-[width] duration-300 ease-out'}
                ${activeTab ? 'opacity-100' : 'opacity-0 border-none'
            }`}
        >
            <div className="h-10 px-4 flex items-center justify-between bg-[#18181b] shrink-0 select-none border-b border-zinc-800/30">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">
                    {activeTab === 'explorer' && t.explorer}
                    {activeTab === 'search' && t.search_placeholder}
                    {activeTab === 'diagnostics' && t.diagnostics}
                    {activeTab === 'cicd' && t.cicd}
                </span>
                <button onClick={() => setActiveTab(null)} className="text-zinc-600 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800/50">
                    {lang === 'ar' ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col relative min-w-[200px]">
                {(activeTab === 'explorer' || activeTab === 'search') && (
                    <>
                        {/* Search/Filter Box */}
                        {(activeTab === 'search' || activeTab === 'explorer') && (
                            <div className="p-3 pb-0">
                                <div className="relative group">
                                    <input 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={activeTab === 'search' ? t.search_placeholder : "Filter files or symbols..."}
                                        className="w-full bg-[#27272a] border border-zinc-700 text-zinc-300 text-xs rounded-md py-1.5 pl-8 pr-3 focus:outline-none focus:border-purple-500/50 focus:bg-[#121212] transition-all placeholder:text-zinc-600"
                                        autoFocus={activeTab === 'search'}
                                    />
                                    <Search size={12} className="absolute left-2.5 top-2 text-zinc-500 group-focus-within:text-purple-500 transition-colors" />
                                    {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-zinc-500 hover:text-white"><X size={10} /></button>}
                                </div>
                            </div>
                        )}

                        {/* Create New File (Explorer Only) */}
                        {activeTab === 'explorer' && !searchTerm && (
                            <div className="p-3">
                                <div className="flex gap-1 group focus-within:ring-1 focus-within:ring-emerald-500/30 rounded-md">
                                    <input 
                                        value={newPath}
                                        onChange={(e) => setNewPath(e.target.value)}
                                        placeholder={t.new_file_placeholder} 
                                        className="flex-1 bg-[#27272a] border border-zinc-700 text-zinc-300 text-xs rounded-l-md py-1.5 px-3 focus:outline-none focus:border-emerald-500/50 font-mono placeholder:text-zinc-600"
                                    />
                                    <button 
                                        onClick={handleCreate} 
                                        disabled={!newPath}
                                        className="px-2.5 bg-[#27272a] border-y border-r border-zinc-700 hover:bg-emerald-900/20 text-emerald-500 rounded-r-md disabled:opacity-30 transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 px-1">
                            {renderFileExplorer()}
                        </div>
                    </>
                )}

                {activeTab === 'diagnostics' && <WiddxDiagnosticsPanel graph={data} onSelectNode={onSelectNode} onRunAudit={onRunAudit} />}
                {activeTab === 'cicd' && <WiddxCicdPanel graph={data} />}
            </div>

            {/* Resize Handle */}
            <div 
                onMouseDown={startResizing}
                className={`absolute top-0 ${lang === 'ar' ? 'left-0' : 'right-0'} w-1 h-full cursor-col-resize z-50 hover:bg-purple-500 transition-colors ${isResizing ? 'bg-purple-500 w-0.5 opacity-100' : 'bg-transparent opacity-0 hover:opacity-100'}`}
            />
        </div>
    </div>
  );
};
