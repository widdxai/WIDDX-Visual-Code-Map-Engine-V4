
import React, { useState } from 'react';
import { 
  AlertCircle, AlertTriangle, ShieldAlert, 
  RefreshCcw, Info, Zap, ChevronRight,
  FileSearch, Trash2, Wrench, PackageSearch, ScanLine, Activity, Check
} from 'lucide-react';
import { WiddxGraph, WiddxIssue, WiddxNodeType } from '../types';

interface WiddxDiagnosticsPanelProps {
  graph: WiddxGraph;
  onSelectNode: (id: string) => void;
  onSmartFix?: (nodeId: string) => void;
  onRunAudit?: () => void;
}

export const WiddxDiagnosticsPanel: React.FC<WiddxDiagnosticsPanelProps> = ({ 
  graph, onSelectNode, onSmartFix, onRunAudit
}) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
      if (onRunAudit) {
          setIsScanning(true);
          onRunAudit();
          setTimeout(() => setIsScanning(false), 800);
      }
  };

  const allIssues = [
    ...graph.errors.map(e => ({ ...e, group: 'CRITICAL' as const })),
    ...graph.conflicts.map(c => ({ ...c, group: 'CONFLICT' as const })),
    ...graph.warnings.map(w => ({ ...w, group: 'WARNING' as const }))
  ];

  const categories = {
    CRITICAL: allIssues.filter(i => i.group === 'CRITICAL'),
    CONFLICT: allIssues.filter(i => i.group === 'CONFLICT'),
    WARNING: allIssues.filter(i => i.group === 'WARNING')
  };

  const renderIssueCard = (issue: WiddxIssue & { group: 'CRITICAL' | 'CONFLICT' | 'WARNING' }) => {
    const isCritical = issue.group === 'CRITICAL';
    const isConflict = issue.group === 'CONFLICT';
    
    return (
      <div 
        key={issue.id}
        className={`group relative flex flex-col p-3 rounded-lg border bg-[#161b22] transition-all hover:bg-[#1c222b] cursor-pointer shadow-sm ${
          isCritical ? 'border-red-500/20 hover:border-red-500/40' : 
          isConflict ? 'border-purple-500/20 hover:border-purple-500/40' : 
          'border-amber-500/20 hover:border-amber-500/40'
        }`}
        onClick={() => issue.nodeId && onSelectNode(issue.nodeId)}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {isCritical ? <AlertCircle size={14} className="text-red-500" /> : 
             isConflict ? <ShieldAlert size={14} className="text-purple-400" /> : 
             <AlertTriangle size={14} className="text-amber-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
                 <span className="text-[11px] font-bold text-slate-200 leading-tight truncate">
                    {issue.type?.replace('_', ' ') || 'SYSTEM ISSUE'}
                 </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed mb-2 opacity-90">
              {issue.message}
            </p>
            {issue.nodeId && (
              <div className="flex items-center gap-1.5 bg-[#0b0e14] w-fit px-2 py-1 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 font-mono truncate max-w-[150px]">
                  {issue.nodeId}
                </span>
                <ChevronRight size={10} className="text-slate-600" />
              </div>
            )}
          </div>
        </div>
        
        {/* Hover Action */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
             className="p-1.5 rounded bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 transition-colors shadow-lg"
             title="Focus Node"
           >
             <Zap size={12} />
           </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] text-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-[#0b0e14]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileSearch size={14} className="text-blue-500" />
                System Health
            </h3>
            {isScanning ? (
                <span className="flex items-center gap-2 text-[10px] text-blue-400 font-bold animate-pulse">
                    <RefreshCcw size={10} className="animate-spin" /> Scanning...
                </span>
            ) : (
                <span className="text-[10px] text-slate-500 font-mono">
                    Live
                </span>
            )}
          </div>
          
          <button 
            onClick={handleScan}
            disabled={isScanning}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                isScanning ? 'bg-blue-600/50 text-white/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95'
            }`}
          >
             {isScanning ? <ScanLine size={14} className="animate-pulse" /> : <Activity size={14} />}
             Run System Audit
          </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2">
             <div className="bg-[#161b22] border border-slate-800 p-2 rounded-lg text-center">
                 <div className="text-[10px] text-slate-500 uppercase font-bold">Files</div>
                 <div className="text-sm font-bold text-slate-200">{graph.nodes.length}</div>
             </div>
             <div className="bg-[#161b22] border border-slate-800 p-2 rounded-lg text-center">
                 <div className="text-[10px] text-slate-500 uppercase font-bold">Links</div>
                 <div className="text-sm font-bold text-slate-200">{graph.edges.length}</div>
             </div>
             <div className="bg-[#161b22] border border-slate-800 p-2 rounded-lg text-center">
                 <div className="text-[10px] text-slate-500 uppercase font-bold">Issues</div>
                 <div className={`text-sm font-bold ${allIssues.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{allIssues.length}</div>
             </div>
        </div>
        
        {/* CRITICAL ERRORS */}
        {categories.CRITICAL.length > 0 && (
          <section className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-wider pl-1">
              Critical Failures
            </div>
            <div className="space-y-2">
              {categories.CRITICAL.map(renderIssueCard)}
            </div>
          </section>
        )}

        {/* STRUCTURAL CONFLICTS */}
        {categories.CONFLICT.length > 0 && (
          <section className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-500">
            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-wider pl-1">
              Structural Conflicts
            </div>
            <div className="space-y-2">
              {categories.CONFLICT.map(renderIssueCard)}
            </div>
          </section>
        )}

        {/* WARNINGS / ORPHANS */}
        {categories.WARNING.length > 0 && (
          <section className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-700">
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider pl-1">
              System Warnings
            </div>
            <div className="space-y-2">
              {categories.WARNING.map(renderIssueCard)}
            </div>
          </section>
        )}

        {/* Empty State */}
        {allIssues.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/5 border border-emerald-500/20">
              <Check size={32} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">Perfect Integrity</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[180px] leading-relaxed">
                Review complete. No broken links, circular dependencies, or empty files detected.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
