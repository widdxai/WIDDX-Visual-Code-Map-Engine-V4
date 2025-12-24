
import React from 'react';
import { 
  Play, Pause, Crosshair, GitGraph, Network, 
  Settings, Palette, Grid, Share2, ArrowUpCircle, ArrowDownCircle, Filter, Check, EyeOff 
} from 'lucide-react';
import { THEMES } from '../constants';
import { HighlightMode } from '../hooks/useWiddxGraphSimulation';

interface GraphControlsProps {
    viewMode: 'graph' | 'mermaid';
    setViewMode: (mode: 'graph' | 'mermaid') => void;
    isPaused: boolean;
    setIsPaused: (val: boolean) => void;
    isFocusMode: boolean;
    setIsFocusMode: (val: boolean) => void;
    highlightMode: HighlightMode;
    setHighlightMode: (mode: HighlightMode) => void;
    filters: { showAssets: boolean; showStyles: boolean; showConfig: boolean };
    setFilters: React.Dispatch<React.SetStateAction<{ showAssets: boolean; showStyles: boolean; showConfig: boolean }>>;
    showFilters: boolean;
    setShowFilters: (val: boolean) => void;
    showSettings: boolean;
    setShowSettings: (val: boolean) => void;
    config: { spacing: number; theme: string };
    setConfig: React.Dispatch<React.SetStateAction<{ spacing: number; theme: string; isPaused: boolean }>>;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
    viewMode, setViewMode, isPaused, setIsPaused, isFocusMode, setIsFocusMode,
    highlightMode, setHighlightMode, filters, setFilters, showFilters, setShowFilters,
    showSettings, setShowSettings, config, setConfig
}) => {
    return (
        <div className="absolute bottom-24 right-8 z-20 flex flex-col items-end gap-3 pointer-events-auto">
            
            {/* HUD: Filter Deck */}
            {viewMode === 'graph' && (
                <div className="hud-panel p-2 rounded-2xl flex items-center gap-2 animate-slide-up">
                    <div className="flex items-center gap-1 bg-[#121212] rounded-xl p-1 border border-white/5">
                        {(['omni', 'upstream', 'downstream'] as const).map((mode) => (
                            <button key={mode} onClick={() => setHighlightMode(mode)}
                                className={`p-2 rounded-lg transition-all ${highlightMode === mode ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                                title={mode.charAt(0).toUpperCase() + mode.slice(1) + " Highlight"}
                            >
                                {mode === 'omni' ? <Share2 size={16} /> : mode === 'upstream' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-2.5 rounded-xl transition-all relative border ${showFilters ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-[#121212] border-white/5 text-zinc-400 hover:text-white'}`}>
                        <Filter size={16} />
                        {(!filters.showAssets || !filters.showConfig || !filters.showStyles) && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_#8b5cf6]"></span>}
                    </button>
                </div>
            )}

            {/* Filter Popover */}
            {showFilters && viewMode === 'graph' && (
                <div className="hud-panel w-52 rounded-2xl p-4 mb-2 animate-in slide-in-from-right-4 zoom-in-95 origin-bottom-right">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-1"><Filter size={12} /> Visibility</h4>
                    <div className="space-y-1">
                        {[ {k:'showAssets',l:'Assets & Media'}, {k:'showStyles',l:'Stylesheets'}, {k:'showConfig',l:'Config Files'} ].map(({k,l}) => (
                            <button key={k} onClick={() => setFilters(p => ({...p, [k]: !p[k as keyof typeof filters]}))} className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-xs text-zinc-300 border border-transparent hover:border-white/5">
                                <span>{l}</span> {filters[k as keyof typeof filters] ? <Check size={14} className="text-purple-400" /> : <EyeOff size={14} className="text-zinc-600" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* HUD: Main Controls */}
            <div className="hud-panel p-2 rounded-2xl flex items-center gap-2">
                {viewMode === 'graph' && (
                    <>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIsPaused(!isPaused)} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isPaused ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-[#121212] border-white/5 text-zinc-400 hover:text-white'}`}>
                                {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
                            </button>
                            <button onClick={() => setIsFocusMode(!isFocusMode)} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isFocusMode ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' : 'bg-[#121212] border-white/5 text-zinc-400 hover:text-white'}`} title="Focus Isolation">
                                <Crosshair size={18} />
                            </button>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                    </>
                )}
                
                <div className="flex items-center gap-1 bg-[#121212] rounded-xl p-1 border border-white/5">
                    <button onClick={() => setViewMode('mermaid')} className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${viewMode === 'mermaid' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <GitGraph size={14} /> Flow
                    </button>
                    <button onClick={() => setViewMode('graph')} className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${viewMode === 'graph' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Network size={14} /> Mesh
                    </button>
                </div>

                <div className="w-px h-6 bg-white/10 mx-1"></div>
                
                <button onClick={() => setShowSettings(!showSettings)} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showSettings ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-[#121212] border-white/5 text-zinc-400 hover:text-white'}`}>
                    <Settings size={18} />
                </button>
            </div>

            {/* Settings Popover */}
            {showSettings && (
                <div className="hud-panel w-72 rounded-2xl p-5 mb-2 animate-in slide-in-from-bottom-4 zoom-in-95 origin-bottom-right">
                    <div className="mb-6">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-3"><Palette size={12} /> Theme Preset</span>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(THEMES).map(t => (
                                <button key={t.id} onClick={() => setConfig(prev => ({ ...prev, theme: t.id }))} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${config.theme === t.id ? 'bg-purple-500/10 border-purple-500/50 text-purple-100 shadow-sm' : 'bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5'}`}>
                                    <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: t.colors.CORE, color: t.colors.CORE }}></div> 
                                    <span className="text-[11px] font-bold">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {viewMode === 'graph' && (
                    <div className="mb-2">
                        <div className="flex items-center justify-between mb-4"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Grid size={12} /> Force Physics</span><span className="text-[10px] text-purple-400 font-mono bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">x{config.spacing.toFixed(1)}</span></div>
                        <input type="range" min="0.5" max="3" step="0.1" value={config.spacing} onChange={(e) => setConfig(prev => ({ ...prev, spacing: parseFloat(e.target.value) }))} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                    </div>
                    )}
                </div>
            )}
        </div>
    );
};
