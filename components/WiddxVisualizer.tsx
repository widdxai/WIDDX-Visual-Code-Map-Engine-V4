
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { WiddxGraph } from '../types';
import { Search, Layers, ChevronRight } from 'lucide-react';
import { THEMES } from '../constants';
import { useWiddxGraphSimulation, HighlightMode } from '../hooks/useWiddxGraphSimulation';
import { WiddxMermaidView } from './WiddxMermaidView';
import { WiddxMinimap } from './WiddxMinimap';
import { GraphControls } from './GraphControls'; 

interface WiddxVisualizerProps {
  data: WiddxGraph;
  projectId: string;
  onNodeSelect: (nodeId: string) => void;
  isActive: boolean; 
}

export const WiddxVisualizer: React.FC<WiddxVisualizerProps> = ({ data, projectId, onNodeSelect, isActive }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'mermaid'>('mermaid');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [currentTransform, setCurrentTransform] = useState({ x: 0, y: 0, k: 0.35 }); 
  const [isPaused, setIsPaused] = useState(false);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('omni');
  const [filters, setFilters] = useState({ showAssets: true, showStyles: true, showConfig: true });
  const [showFilters, setShowFilters] = useState(false);

  // Filter Logic
  const filteredGraph = useMemo(() => {
    if (filters.showAssets && filters.showStyles && filters.showConfig) return data;
    const allowedNodes = data.nodes.filter(n => {
        const name = n.name.toLowerCase();
        if (!filters.showAssets && name.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) return false;
        if (!filters.showStyles && name.match(/\.(css|scss|less|sass)$/)) return false;
        if (!filters.showConfig && (name.includes('config') || name.startsWith('.') || name.endsWith('.json'))) return false;
        return true;
    });
    const allowedIds = new Set(allowedNodes.map(n => n.id));
    const allowedEdges = data.edges.filter(e => allowedIds.has(e.source) && allowedIds.has(e.target));
    return { ...data, nodes: allowedNodes, edges: allowedEdges };
  }, [data, filters]);

  const handleNodeSelect = (id: string) => {
      setLocalSelectedId(id);
      onNodeSelect(id);
  };

  const { config, setConfig, nodes } = useWiddxGraphSimulation(
      svgRef, filteredGraph, projectId, dimensions, handleNodeSelect,
      isFocusMode ? localSelectedId : null, isActive, highlightMode
  );
  
  const activeTheme = THEMES[config.theme];

  // Sync Pause State with Simulation Hook
  useEffect(() => { setConfig(prev => ({ ...prev, isPaused })); }, [isPaused, setConfig]);

  // Transform Observer for Minimap
  useEffect(() => {
      if (!svgRef.current) return;
      const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'transform') {
                   const transformVal = (mutation.target as SVGGElement).getAttribute('transform');
                   if (transformVal) {
                       const translateMatch = transformVal.match(/translate\(([^,]+),([^)]+)\)/);
                       const scaleMatch = transformVal.match(/scale\(([^)]+)\)/);
                       if (translateMatch && scaleMatch) {
                           setCurrentTransform({ x: parseFloat(translateMatch[1]), y: parseFloat(translateMatch[2]), k: parseFloat(scaleMatch[1]) });
                       }
                   }
              }
          });
      });
      const checkGroup = setInterval(() => {
          const group = svgRef.current?.querySelector('.graph-container');
          if (group) { observer.observe(group, { attributes: true }); clearInterval(checkGroup); }
      }, 500);
      return () => { clearInterval(checkGroup); observer.disconnect(); };
  }, [viewMode]);

  // Resize Observer
  useEffect(() => {
    if (!wrapperRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full overflow-hidden relative shadow-inner transition-colors duration-500" style={{ backgroundColor: activeTheme.colors.BG }}>
      
      {viewMode === 'graph' ? <svg ref={svgRef} width="100%" height="100%" className="cursor-move relative z-10 animate-fade-in" style={{contain: 'strict'}} /> : <WiddxMermaidView data={filteredGraph} onNodeSelect={handleNodeSelect} />}
      
      {/* Breadcrumbs */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-2 px-4 py-2 bg-[#09090b]/40 backdrop-blur-md border border-slate-700/50 rounded-full pointer-events-none select-none shadow-xl">
          <Layers size={14} className="text-blue-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Blueprint</span>
          <ChevronRight size={12} className="text-slate-600" />
          <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">{viewMode === 'mermaid' ? 'Logical Flow' : 'Neural Mesh'}</span>
      </div>

      {/* Minimap */}
      {viewMode === 'graph' && isActive && (
          <div className="absolute bottom-24 left-8 z-20 pointer-events-none animate-in slide-in-from-bottom-4">
              <WiddxMinimap nodes={nodes} transform={currentTransform} mainWidth={dimensions.width} mainHeight={dimensions.height} />
          </div>
      )}

      {/* Extracted Controls Component */}
      <GraphControls 
          viewMode={viewMode} setViewMode={setViewMode}
          isPaused={isPaused} setIsPaused={setIsPaused}
          isFocusMode={isFocusMode} setIsFocusMode={setIsFocusMode}
          highlightMode={highlightMode} setHighlightMode={setHighlightMode}
          filters={filters} setFilters={setFilters}
          showFilters={showFilters} setShowFilters={setShowFilters}
          showSettings={showSettings} setShowSettings={setShowSettings}
          config={config} setConfig={setConfig}
      />

      {/* Search Bar (Only Graph Mode) */}
      {viewMode === 'graph' && (
        <div className="absolute top-5 right-5 z-20 pointer-events-auto">
           <div className="relative group">
               <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
               <input type="text" placeholder="Filter nodes..." className="bg-[#09090b]/40 backdrop-blur-md border border-slate-700/50 text-slate-200 text-xs rounded-full py-2.5 pl-9 pr-4 w-48 focus:w-64 transition-all focus:outline-none focus:border-blue-500/50 shadow-lg placeholder:text-slate-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
        </div>
      )}
    </div>
  );
};
