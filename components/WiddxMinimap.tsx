
import React, { useEffect, useRef } from 'react';
import { WiddxNode, WiddxNodeType } from '../types';

interface WiddxMinimapProps {
  nodes: WiddxNode[];
  width?: number;
  height?: number;
  transform: { x: number; y: number; k: number }; // Current zoom/pan of main graph
  mainWidth: number;
  mainHeight: number;
}

export const WiddxMinimap: React.FC<WiddxMinimapProps> = ({ 
  nodes, width = 120, height = 120, transform, mainWidth, mainHeight 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
        // Clear
        ctx.clearRect(0, 0, width, height);

        // Calculate Scale to fit all nodes
        // Since D3 force graph centers at (0,0), we need to estimate bounds
        // Usually nodes spread between -1000 and 1000 depending on count
        const range = 2000; 
        const scale = width / range; 
        const centerOffset = width / 2;

        // Draw Nodes
        nodes.forEach((node: any) => {
            if (node.x === undefined || node.y === undefined) return;
            
            const x = (node.x * scale) + centerOffset;
            const y = (node.y * scale) + centerOffset;

            // Simple culling
            if (x < 0 || x > width || y < 0 || y > height) return;

            ctx.beginPath();
            if (node.type === WiddxNodeType.FOLDER) {
                ctx.fillStyle = '#334155';
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            } else if (node.type === WiddxNodeType.MISSING) {
                ctx.fillStyle = '#ef4444';
                ctx.arc(x, y, 2, 0, Math.PI * 2);
            } else {
                ctx.fillStyle = '#3b82f6';
                ctx.rect(x - 1.5, y - 1.5, 3, 3);
            }
            ctx.fill();
        });

        // Draw Viewport Rect (Reverse logic of D3 transform)
        // transform.x/y is the translation applied to the group
        // transform.k is scale
        // We need to find "What part of the world is currently visible?"
        
        // World coordinates of top-left corner:
        const worldLeft = -transform.x / transform.k;
        const worldTop = -transform.y / transform.k;
        
        // World dimensions of viewport:
        const worldWidth = mainWidth / transform.k;
        const worldHeight = mainHeight / transform.k;

        // Map world coords to minimap coords
        const mapX = (worldLeft * scale) + centerOffset;
        const mapY = (worldTop * scale) + centerOffset;
        const mapW = worldWidth * scale;
        const mapH = worldHeight * scale;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX, mapY, mapW, mapH);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(mapX, mapY, mapW, mapH);

        animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, width, height, transform, mainWidth, mainHeight]);

  return (
    <div className="bg-[#0b0e14]/80 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden pointer-events-none">
        <canvas ref={canvasRef} width={width} height={height} className="block" />
    </div>
  );
};
