import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { MermaidGenerator } from '../services/mermaidGenerator';
import { WiddxGraph } from '../types';
import { 
  Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, 
  Maximize
} from 'lucide-react';

interface WiddxMermaidViewProps {
  data: WiddxGraph;
  onNodeSelect: (id: string) => void;
}

export const WiddxMermaidView: React.FC<WiddxMermaidViewProps> = ({ data, onNodeSelect }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Transform State (Manual)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        rankSpacing: 80,
        nodeSpacing: 50,
        padding: 50
      },
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#e2e8f0',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        mainBkg: '#0f172a',
        nodeBorder: '#475569',
        lineColor: '#64748b',
        edgeLabelBackground: '#1e293b',
        clusterBkg: 'transparent',
        clusterBorder: '#334155',
        titleColor: '#94a3b8'
      }
    });
  }, []);

  const renderDiagram = useCallback(async () => {
    if (!data.nodes || data.nodes.length === 0) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const definition = MermaidGenerator.generate(data);
      const id = `graph-${Date.now()}`;
      
      const { svg } = await mermaid.render(id, definition);
      
      const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
      let contentWidth = 1500;
      let contentHeight = 1500;

      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        if (parts.length === 4) {
            contentWidth = parts[2];
            contentHeight = parts[3];
        }
      }

      const cleanSvg = svg
        .replace(/width=["'][^"']*["']/, `width="${contentWidth}px"`)
        .replace(/height=["'][^"']*["']/, `height="${contentHeight}px"`)
        .replace(/style=["'][^"']*["']/, 'style="max-width: none !important; background-color: transparent !important;"');

      setSvgContent(cleanSvg);
      
      // Auto-Fit Logic
      if (wrapperRef.current) {
          const { clientWidth, clientHeight } = wrapperRef.current;
          const padding = 100;
          const scaleX = (clientWidth - padding) / contentWidth;
          const scaleY = (clientHeight - padding) / contentHeight;
          const fitScale = Math.min(scaleX, scaleY, 1);
          
          const x = (clientWidth - (contentWidth * fitScale)) / 2;
          const y = (clientHeight - (contentHeight * fitScale)) / 2;

          setTransform({ x, y, k: Math.max(0.05, fitScale) });
      }

    } catch (err: any) {
      console.error("Mermaid Render Error:", err);
      setError("Failed to render graph. The structure might be too complex or contain invalid characters.");
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    const t = setTimeout(renderDiagram, 50);
    return () => clearTimeout(t);
  }, [renderDiagram]);

  // Handle Dragging (Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Handle Zoom
  const handleWheel = (e: React.WheelEvent) => {
    const scaleFactor = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.01, Math.min(10, transform.k + (direction * scaleFactor)));
    setTransform(prev => ({ ...prev, k: newScale }));
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const nodes = containerRef.current.querySelectorAll('.node');
    
    nodes.forEach(node => {
      (node as HTMLElement).style.cursor = 'pointer';
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = node.textContent?.trim();
        const found = data.nodes.find(n => n.name === text || n.id.includes(text || '###'));
        if (found) onNodeSelect(found.id);
      });
    });
  }, [svgContent, data, onNodeSelect]);

  return (
    <div className="w-full h-full bg-[#0b0e14] widdx-engineering-bg relative overflow-hidden flex flex-col">
      
      {/* Controls */}
      <div className="absolute top-6 right-6 z-30 flex flex-col gap-2">
         <div className="bg-[#1e293b]/90 backdrop-blur border border-slate-700 p-1.5 rounded-xl shadow-xl flex flex-col gap-1">
            <button onClick={() => setTransform(t => ({...t, k: t.k * 1.2}))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ZoomIn size={18} /></button>
            <button onClick={() => setTransform(t => ({...t, k: t.k / 1.2}))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ZoomOut size={18} /></button>
            <button onClick={() => renderDiagram()} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><Maximize size={18} /></button>
         </div>
         <div className="bg-[#1e293b]/90 backdrop-blur border border-slate-700 p-1.5 rounded-xl shadow-xl">
             <button onClick={renderDiagram} className="p-2 hover:bg-blue-600/20 hover:text-blue-400 rounded-lg text-slate-300"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
         </div>
      </div>

      {/* Main Viewport */}
      <div 
        ref={wrapperRef}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-[#0b0e14]/50 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        )}

        {error && (
            <div className="absolute inset-0 flex items-center justify-center z-40">
                <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-200 text-sm">{error}</p>
                </div>
            </div>
        )}

        <div 
          ref={containerRef}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          className="absolute top-0 left-0 origin-top-left"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
};