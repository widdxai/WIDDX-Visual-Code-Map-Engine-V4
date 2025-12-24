
import React, { useState } from 'react';
import { 
    AlertCircle, ChevronUp, ChevronDown, CheckCircle, Wrench, Sparkles, 
    Loader2, ArrowRight, ShieldAlert, Trash2, FileWarning, Search, 
    Zap, Layers, Globe, ClipboardList, CheckSquare, 
    FileCode, Share2, Database, Box, Server, Code, Activity, CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';
import { WiddxGraph, WiddxNode, WiddxNodeType, WiddxFlowStatus } from '../types';
import { Language, translations } from '../services/i18n';

interface WiddxMissingImportsPanelProps {
  graph: WiddxGraph;
  onFixFile: (path: string, importerId: string | null, userHint?: string) => void;
  onFixAll?: (missingNodes: WiddxNode[]) => void;
  onDeleteFile: (path: string) => void;
  onSelectNode: (id: string) => void;
  isFixing?: boolean;
  lang: Language;
  selectedNodeId: string | null;
}

type DiagnosticsTab = 'broken' | 'orphans' | 'conflicts' | 'tasks';

export const WiddxMissingImportsPanel: React.FC<WiddxMissingImportsPanelProps> = ({ 
  graph, onFixFile, onFixAll, onDeleteFile, onSelectNode, isFixing = false, lang, selectedNodeId 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('broken');
  const [activeRepairId, setActiveRepairId] = useState<string | null>(null);
  const [repairHint, setRepairHint] = useState('');
  
  const t = translations[lang];
  if (!graph) return null;

  // --- Graph Data Analysis ---
  const missingFiles = graph.nodes.filter(n => n.type === WiddxNodeType.MISSING);
  const orphanedFiles = graph.nodes.filter(n => n.status === WiddxFlowStatus.ORPHAN && n.type === WiddxNodeType.FILE);
  const conflicts = graph.conflicts.filter(c => c.type !== 'TODO');
  const todoItems = graph.conflicts.filter(c => c.type === 'TODO');
  
  // Real Errors (Protocol violations, Circular deps, generic errors)
  const systemErrors = graph.errors;
  
  const errorCount = systemErrors.length;
  const conflictCount = conflicts.length;
  
  // Status Logic
  const isClean = errorCount === 0 && conflictCount === 0 && missingFiles.length === 0;
  const filesCount = graph.nodes.filter(n => n.type === WiddxNodeType.FILE).length;
  const edgesCount = graph.edges.length;

  // Protocol Logic
  const protocols = graph.widdxMeta.protocols || ['UNIVERSAL'];
  const protocolLabel = protocols.length > 1 ? 'Hybrid System' : (protocols[0] === 'UNIVERSAL' ? 'Universal' : protocols[0]);
  
  const getProtocolIcon = (p: string) => {
      if (p === 'CHROME_EXT_V3') return Box;
      if (p === 'LARAVEL_MVC') return Server;
      if (p === 'REACT_MODERN') return Code;
      return Globe;
  };
  const ProtocolIcon = protocols.length > 1 ? Layers : getProtocolIcon(protocols[0]);

  // Selected Node Logic
  const selectedNode = selectedNodeId ? graph.nodes.find(n => n.id === selectedNodeId) : null;
  const selectedLines = selectedNode?.type === WiddxNodeType.FILE ? selectedNode.size : 0;

  // Visual Identity Logic (Subtle Indicators)
  const statusBorderColor = isOpen 
        ? 'border-t-zinc-800' // Neutral when open
        : (errorCount > 0 || missingFiles.length > 0 ? 'border-t-red-500/50' : (conflictCount > 0 ? 'border-t-amber-500/50' : 'border-t-purple-500/30'));

  const statusGlow = isOpen ? '' : (errorCount > 0 ? 'shadow-[0_-1px_10px_rgba(239,68,68,0.1)]' : '');

  const handleToggle = (tab: DiagnosticsTab) => {
    if (isOpen && activeTab === tab) setIsOpen(false);
    else { setActiveTab(tab); setIsOpen(true); }
  };

  const resolveSuggestedPath = (node: WiddxNode) => {
      const rawImport = node.id.replace('MISSING:', '');
      if (!rawImport.startsWith('.') && !rawImport.startsWith('/')) return '/' + rawImport;
      const parentDir = (node.parentId === '/' || !node.parentId) ? '' : node.parentId;
      const stack = parentDir.split('/').filter((p) => p); 
      const parts = rawImport.split('/');
      for (const part of parts) {
          if (part === '.' || part === '') continue;
          if (part === '..') { if (stack.length > 0) stack.pop(); } 
          else { stack.push(part); }
      }
      return '/' + stack.join('/');
  };

  return (
    <div className={`w-full z-30 flex flex-col transition-all duration-300 ease-out border-t bg-[#18181b] backdrop-blur-md shrink-0 ${statusBorderColor} ${statusGlow} ${isOpen ? 'h-[450px]' : 'h-8'}`}>
       
       {/* --- EXPANDED CONTENT (DRAWER) --- */}
       <div className={`flex-1 overflow-hidden flex flex-col relative ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
           <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-[#202024]">
                <div className="flex items-center gap-4">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                        {activeTab === 'broken' && <><AlertCircle className="text-red-500" size={16} /> SYSTEM REPAIR BAY</>}
                        {activeTab === 'orphans' && <><FileWarning className="text-amber-500" size={16} /> ORPHANED ARTIFACTS</>}
                        {activeTab === 'conflicts' && <><ShieldAlert className="text-purple-500" size={16} /> ARCHITECTURAL CONFLICTS</>}
                        {activeTab === 'tasks' && <><ClipboardList className="text-blue-500" size={16} /> PENDING TASKS (TODO/FIXME)</>}
                    </h3>
                    
                    {activeTab === 'broken' && missingFiles.length > 0 && onFixAll && (
                        <button 
                            onClick={() => onFixAll(missingFiles)} 
                            disabled={isFixing}
                            className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${isFixing ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-purple-600/20 border-purple-500/50 text-purple-400 hover:bg-purple-600 hover:text-white'}`}
                        >
                            {isFixing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {t.fix_all} ({missingFiles.length})
                        </button>
                    )}
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"><ChevronDown size={16} /></button>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#121212]">
               {activeTab === 'broken' && (
                 <div className="space-y-8">
                    
                    {/* 1. Critical System Errors (Protocol, Circular, etc) */}
                    {systemErrors.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase tracking-widest pl-1 border-b border-red-900/30 pb-2">
                                Critical Alerts ({systemErrors.length})
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {systemErrors.map(err => (
                                    <div key={err.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-900/10 hover:bg-red-900/20 transition-colors">
                                        <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-red-200">{err.type?.replace('_', ' ') || 'ERROR'}</span>
                                                {err.nodeId && (
                                                    <button onClick={() => onSelectNode(err.nodeId!)} className="text-[10px] bg-red-950 border border-red-800 text-red-300 px-2 py-0.5 rounded hover:bg-red-900 transition-colors font-mono">
                                                        {err.nodeId}
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-red-300/80 mt-1 leading-relaxed">{err.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Missing Files (Broken Imports) */}
                    {missingFiles.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest pl-1 border-b border-purple-900/30 pb-2">
                                Missing Artifacts & Broken Links ({missingFiles.length})
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {missingFiles.map(node => {
                                    const suggestedPath = resolveSuggestedPath(node);
                                    const isExpanded = activeRepairId === node.id;
                                    return (
                                    <div key={node.id} className={`flex flex-col rounded-xl bg-[#18181b] border transition-all ${isExpanded ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-red-900/30 hover:border-red-500/50'}`}>
                                        <div className="p-4 flex items-start justify-between gap-3">
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-2 text-xs font-bold text-red-200 font-mono"><AlertCircle size={14} /> {node.id.replace('MISSING:', '')}</div>
                                                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1"><ArrowRight size={10} /> {suggestedPath}</div>
                                            </div>
                                            <button onClick={() => { setActiveRepairId(isExpanded ? null : node.id); setRepairHint(''); }} className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                                                <Wrench size={14} />
                                            </button>
                                        </div>
                                        {isExpanded && (
                                            <div className="p-4 pt-0 animate-fade-in">
                                                <textarea value={repairHint} onChange={(e) => setRepairHint(e.target.value)} placeholder="Context hint..." className="w-full h-20 bg-[#121212] border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 focus:border-purple-500 outline-none mb-3 resize-none" />
                                                <button onClick={() => onFixFile(suggestedPath, graph.edges.find(e => e.target === node.id)?.source || null, repairHint)} disabled={isFixing} className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg">
                                                    {isFixing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} GENERATE FIX
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {missingFiles.length === 0 && systemErrors.length === 0 && (
                        <div className="col-span-full h-40 flex flex-col items-center justify-center opacity-50">
                            <CheckCircle size={40} className="text-emerald-500 mb-2"/>
                            <p className="text-zinc-400">System Integrity Nominal</p>
                        </div>
                    )}
                 </div>
               )}
               
               {activeTab === 'orphans' && (
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {orphanedFiles.length > 0 ? orphanedFiles.map(node => (
                           <div key={node.id} className="bg-[#18181b] border border-amber-900/30 rounded-xl p-3 hover:border-amber-500/50 transition-all group relative">
                               <div className="text-xs font-bold text-zinc-200 truncate mb-1">{node.name}</div>
                               <div className="text-[10px] text-zinc-500 font-mono truncate">{node.id}</div>
                               <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => onSelectNode(node.id)} className="p-1.5 bg-zinc-800 rounded hover:bg-blue-600 hover:text-white"><Search size={12}/></button>
                                   <button onClick={() => onDeleteFile(node.id)} className="p-1.5 bg-zinc-800 rounded hover:bg-red-600 hover:text-white"><Trash2 size={12}/></button>
                               </div>
                           </div>
                       )) : <div className="col-span-full h-40 flex flex-col items-center justify-center opacity-50"><CheckCircle size={40} className="text-emerald-500 mb-2"/><p>No Orphans</p></div>}
                   </div>
               )}

               {activeTab === 'conflicts' && (
                   <div className="space-y-2">
                       {conflicts.length > 0 ? conflicts.map(c => (
                           <div key={c.id} className="bg-[#18181b] border border-purple-900/30 rounded-xl p-4 flex items-center gap-4 hover:border-purple-500/50 transition-all cursor-pointer" onClick={() => c.nodeId && onSelectNode(c.nodeId)}>
                               <ShieldAlert size={18} className="text-purple-500" />
                               <div>
                                   <div className="text-xs font-bold text-zinc-200">{c.message}</div>
                                   <div className="text-[10px] text-zinc-500 font-mono">{c.nodeId}</div>
                               </div>
                           </div>
                       )) : <div className="h-40 flex flex-col items-center justify-center opacity-50"><CheckCircle size={40} className="text-emerald-500 mb-2"/><p>Architecture Clean</p></div>}
                   </div>
               )}

               {activeTab === 'tasks' && (
                   <div className="space-y-2">
                       {todoItems.length > 0 ? todoItems.map(c => (
                           <div key={c.id} className="bg-[#18181b] border border-blue-900/30 rounded-xl p-4 flex items-center gap-4 hover:border-blue-500/50 transition-all cursor-pointer group" onClick={() => c.nodeId && onSelectNode(c.nodeId)}>
                               <CheckSquare size={18} className="text-blue-500 group-hover:text-white transition-colors" />
                               <div className="flex-1">
                                   <div className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">{c.message}</div>
                                   <div className="text-[10px] text-zinc-500 font-mono mt-1">{c.nodeId}</div>
                               </div>
                               <button className="text-xs bg-zinc-800 hover:bg-blue-600 px-3 py-1.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                                   Resolve
                               </button>
                           </div>
                       )) : <div className="h-40 flex flex-col items-center justify-center opacity-50"><CheckCircle size={40} className="text-blue-500 mb-2"/><p>No Pending Tasks</p></div>}
                   </div>
               )}
           </div>
       </div>

       {/* --- MERGED STATUS BAR & HEADER --- */}
       <div className={`h-8 flex items-center justify-between text-zinc-400 shrink-0 relative z-20 transition-colors duration-300`}>
          
          {/* Left: Diagnostics Toggles */}
          <div className="flex items-center h-full">
            <button onClick={() => setIsOpen(!isOpen)} className="h-full px-3 hover:bg-[#202024] hover:text-zinc-200 border-r border-zinc-800 transition-colors">
                {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            
            {/* System Health Pulse */}
            <div className={`flex items-center gap-2 px-3 border-r border-zinc-800 h-full ${!isClean ? 'text-amber-400' : 'text-emerald-500'}`} title={isClean ? "System Stable" : "Issues Detected"}>
                {isClean ? <CheckCircle2 size={12} /> : <Activity size={12} className={!isOpen ? "animate-pulse" : ""} />}
                {!isOpen && (
                    <span className={`text-[10px] font-bold hidden sm:inline ${!isClean ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {isClean ? (lang === 'ar' ? 'نظام مستقر' : 'System Healthy') : (lang === 'ar' ? 'انتباه' : 'Attention')}
                    </span>
                )}
            </div>

            {/* Error Counters (Clickable to open specific tab) */}
            <button onClick={() => handleToggle('broken')} className={`h-full px-3 flex items-center gap-2 text-[10px] font-bold border-r border-zinc-800 transition-all ${errorCount > 0 ? 'text-red-400 hover:bg-red-900/10' : 'hover:bg-[#202024] text-zinc-500'}`}>
                <AlertCircle size={12} /> {errorCount}
            </button>
            <button onClick={() => handleToggle('conflicts')} className={`h-full px-3 flex items-center gap-2 text-[10px] font-bold border-r border-zinc-800 transition-all ${conflictCount > 0 ? 'text-purple-400 hover:bg-purple-900/10' : 'hover:bg-[#202024] text-zinc-500'}`}>
                <ShieldAlert size={12} /> {conflictCount}
            </button>
            <button onClick={() => handleToggle('orphans')} className={`h-full px-3 flex items-center gap-2 text-[10px] font-bold border-r border-zinc-800 transition-all ${orphanedFiles.length > 0 ? 'text-amber-400 hover:bg-amber-900/10' : 'hover:bg-[#202024] text-zinc-500'}`}>
                <FileWarning size={12} /> {orphanedFiles.length}
            </button>
          </div>

          {/* Right: System Context (Previously Status Bar Right) */}
          <div className="flex items-center gap-4 px-4 h-full">
             {/* Selected Node Info */}
             {selectedNode ? (
                 <div className="flex items-center gap-2 border-r border-zinc-800 pr-3 mr-1 hidden md:flex text-zinc-300">
                    <FileCode size={11} className="opacity-70" />
                    <span className="font-mono text-[10px] truncate max-w-[150px]">{selectedNode.name}</span>
                    {selectedNode.type === WiddxNodeType.FILE && (
                         <span className="opacity-60 font-mono text-[9px]">({selectedLines} L)</span>
                    )}
                </div>
             ) : (
                <div className="flex items-center gap-3 border-r border-zinc-800 pr-3 mr-1 opacity-50 hidden md:flex">
                    <span className="flex items-center gap-1 text-[10px]"><Share2 size={10} /> {edgesCount}</span>
                    <span className="flex items-center gap-1 text-[10px]"><FileCode size={10} /> {filesCount}</span>
                </div>
             )}

             {/* Protocol Info */}
             <div className="flex items-center gap-1.5 hover:bg-[#202024] hover:text-zinc-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors" title={`Active: ${protocols.join(', ')}`}>
                 <ProtocolIcon size={11} />
                 <span className="text-[10px] font-medium hidden sm:inline">{protocolLabel}</span>
             </div>

             {/* AI Status */}
             <div className="flex items-center gap-1.5 hover:bg-[#202024] hover:text-zinc-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
                 <Zap size={10} className="text-yellow-500/80 fill-current" />
                 <span className="text-[10px] font-bold hidden sm:inline">AI Online</span>
             </div>
          </div>
       </div>
    </div>
  );
};
