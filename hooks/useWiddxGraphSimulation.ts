
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { WiddxGraph, WiddxNode, WiddxNodeType } from '../types';
import { THEMES } from '../constants';
import { StorageService } from '../services/storageService';

export type HighlightMode = 'omni' | 'upstream' | 'downstream';

export const useWiddxGraphSimulation = (
    svgRef: React.RefObject<SVGSVGElement>,
    data: WiddxGraph,
    projectId: string,
    dimensions: { width: number; height: number },
    onNodeSelect: (id: string) => void,
    focusedNodeId: string | null, // New parameter for isolation mode
    isActive: boolean = true, // Control simulation status
    highlightMode: HighlightMode = 'omni' // NEW: Directional highlighting
) => {
    const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
    const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const svgSelection = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    
    // Split adjacency maps for directional analysis
    const inboundMap = useRef<Map<string, Set<string>>>(new Map());
    const outboundMap = useRef<Map<string, Set<string>>>(new Map());
    
    // Store saved positions in a ref to apply on initialization
    const savedPositionsRef = useRef<Record<string, {x: number, y: number}>>({});

    const [config, setConfig] = useState({
        spacing: 1.0, 
        theme: 'ENGINEERING',
        isPaused: false
    });

    const activeTheme = THEMES[config.theme].colors;

    // Load saved layout on mount
    useEffect(() => {
        if (!projectId) return;
        StorageService.loadUiState(projectId, 'graph_positions').then(positions => {
            if (positions) {
                savedPositionsRef.current = positions;
            }
        });
    }, [projectId]);

    const { nodes, links } = useMemo(() => {
        if (!data) return { nodes: [], links: [] };
        // Create shallow copies of nodes to avoid mutating original state directly
        // IMPORTANT: We will patch these objects with previous coordinates in the effect below
        const nodes = data.nodes.map(n => ({ ...n }));
        const links: any[] = [];
        
        const inMap = new Map<string, Set<string>>();
        const outMap = new Map<string, Set<string>>();
        const missingNodeIds = new Set(data.nodes.filter(n => n.type === WiddxNodeType.MISSING).map(n => n.id));
        
        const addEdgeToMaps = (source: string, target: string) => {
            if (!outMap.has(source)) outMap.set(source, new Set());
            outMap.get(source)!.add(target);

            if (!inMap.has(target)) inMap.set(target, new Set());
            inMap.get(target)!.add(source);
        };

        nodes.forEach(n => {
            if (n.parentId && n.parentId !== '/') {
                links.push({
                    source: n.parentId,
                    target: n.id,
                    type: 'STRUCTURE',
                    strength: 0.9 
                });
                addEdgeToMaps(n.parentId, n.id);
            }
        });

        data.edges.forEach(e => {
            links.push({
                source: e.source,
                target: e.target,
                type: 'DEPENDENCY',
                strength: 0.1, 
                // Optimization: Use Set lookup instead of .find() inside loop
                isBroken: missingNodeIds.has(e.target)
            });
            addEdgeToMaps(e.source, e.target);
        });

        inboundMap.current = inMap;
        outboundMap.current = outMap;

        return { nodes, links };
    }, [data]);

    useEffect(() => {
        if (!nodes.length || !svgRef.current) return;

        const { width, height } = dimensions;
        const svg = d3.select(svgRef.current);
        svgSelection.current = svg;

        // --- COORDINATE PRESERVATION (WARM START + PERSISTENCE) ---
        let warmStart = false;
        
        // 1. Check in-memory previous simulation
        if (simulationRef.current) {
            const oldNodes = simulationRef.current.nodes() as any[];
            const oldNodeMap = new Map(oldNodes.map(n => [n.id, n]));
            
            nodes.forEach((newNode: any) => {
                const oldNode = oldNodeMap.get(newNode.id);
                if (oldNode) {
                    newNode.x = oldNode.x;
                    newNode.y = oldNode.y;
                    newNode.vx = oldNode.vx;
                    newNode.vy = oldNode.vy;
                }
            });
            warmStart = true;
            simulationRef.current.stop();
        } else {
            // 2. Check Persisted Storage (First Load)
            const savedPos = savedPositionsRef.current;
            if (Object.keys(savedPos).length > 0) {
                 nodes.forEach((newNode: any) => {
                    const saved = savedPos[newNode.id];
                    if (saved) {
                        newNode.x = saved.x;
                        newNode.y = saved.y;
                    }
                });
                // Slight alpha to settle nodes if positions exist but links changed
                warmStart = true; 
            }

            // First run cleanup
            svg.selectAll('*').remove();
        }

        // --- SETUP SVG STRUCTURE (Only if cold start) ---
        let container = svg.select('.graph-container');
        if (container.empty()) {
            container = svg.append('g').attr('class', 'graph-container');
            const zoom = d3.zoom<SVGSVGElement, unknown>()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => container.attr('transform', event.transform));
            
            zoomBehavior.current = zoom;
            svg.call(zoom);
            svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.35));

            // Defs
            const defs = svg.append('defs');
            defs.append('marker').attr('id', 'arrow-electric')
                .attr('viewBox', '0 -5 10 10').attr('refX', 22).attr('refY', 0)
                .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
                .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', activeTheme.LINK_DEP);

            defs.append('marker').attr('id', 'arrow-error')
                .attr('viewBox', '0 -5 10 10').attr('refX', 20).attr('refY', 0)
                .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
                .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', activeTheme.MISSING);
        }

        // --- PHYSICS ENGINE ---
        const simulation = d3.forceSimulation(nodes as any)
            .force('center', d3.forceCenter(0, 0).strength(0.01))
            .force('x', d3.forceX(0).strength(0.01))
            .force('y', d3.forceY(0).strength(0.01))
            .force('charge', d3.forceManyBody().strength((d: any) => d.type === WiddxNodeType.FOLDER ? -2000 : -600))
            .force('collide', d3.forceCollide().radius((d: any) => d.type === WiddxNodeType.FOLDER ? 120 : 70).strength(0.7).iterations(2))
            .velocityDecay(0.6);
        
        // Use lower alpha for warm starts so nodes settle gently
        simulation.alpha(warmStart ? 0.3 : 1).alphaDecay(0.03);

        simulationRef.current = simulation;

        // --- DATA BINDING (General Update Pattern) ---
        
        // 1. LINKS
        const linksLayer = container.selectChildren('.links-layer');
        const linksGroup = linksLayer.empty() ? container.insert('g', ':first-child').attr('class', 'links-layer') : linksLayer;
        
        const linkSelection = linksGroup.selectAll('path').data(links, (d: any) => `${d.source.id}-${d.target.id}`);
        linkSelection.exit().remove();
        
        const linkEnter = linkSelection.enter().append('path')
            .attr('class', 'link-path').attr('fill', 'none');
            
        const linkPath = linkEnter.merge(linkSelection as any);

        // 2. NODES
        const nodesLayer = container.selectChildren('.nodes-layer');
        const nodesGroup = nodesLayer.empty() ? container.append('g').attr('class', 'nodes-layer') : nodesLayer;

        const nodeSelection = nodesGroup.selectAll('g.node-element').data(nodes, (d: any) => d.id);
        nodeSelection.exit().transition().duration(300).attr('opacity', 0).remove();

        const nodeEnter = nodeSelection.enter().append('g')
            .attr('class', 'node-element')
            .attr('opacity', 0) // Start transparent
            .call(d3.drag<SVGGElement, any>()
                .on('start', (e, d) => { 
                    if (!e.active && !config.isPaused && isActive) simulation.alphaTarget(0.3).restart(); 
                    d.fx = d.x; d.fy = d.y; 
                })
                .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end', (e, d) => { 
                    if (!e.active) simulation.alphaTarget(0); 
                    d.fx = null; d.fy = null;
                    
                    // SAVE POSITIONS ON DRAG END
                    savePositions(simulation.nodes());
                })
            )
            .on('click', (e, d: any) => { e.stopPropagation(); onNodeSelect(d.id); });

        // Node Enter Transitions
        nodeEnter.transition().duration(500).attr('opacity', 1);

        // Append Shapes (Only for new nodes)
        nodeEnter.each(function(d: any) {
             const el = d3.select(this);
             const isFolder = d.type === WiddxNodeType.FOLDER;
             if (isFolder) {
                el.append('circle').attr('class', 'folder-zone').attr('r', 55).attr('fill', 'none').attr('stroke-dasharray', '4,4');
                el.append('rect').attr('class', 'folder-body').attr('x', -18).attr('y', -14).attr('width', 36).attr('height', 28).attr('rx', 4);
                el.append('rect').attr('class', 'folder-tab').attr('x', -18).attr('y', -18).attr('width', 16).attr('height', 8).attr('rx', 2);
                el.append('text').attr('class', 'node-label').attr('y', 40).attr('text-anchor', 'middle').text(d.name).style('font-size', '10px').style('font-weight', 'bold');
            } else {
                const w = Math.min(200, Math.max(90, d.name.length * 6 + 20));
                el.append('rect').attr('class', 'issue-glow').attr('x', -w / 2 - 4).attr('y', -20).attr('width', w + 8).attr('height', 40).attr('rx', 10).attr('fill', 'none').attr('opacity', 0);
                el.append('rect').attr('class', 'file-card').attr('x', -w / 2).attr('y', -15).attr('width', w).attr('height', 30).attr('rx', 6);
                el.append('rect').attr('class', 'file-tag').attr('x', -w / 2 + 4).attr('y', -9).attr('width', 3).attr('height', 18).attr('rx', 1.5);
                el.append('text').attr('class', 'node-label').attr('x', 6).attr('y', 4).attr('text-anchor', 'middle').text(d.name).style('font-size', '9px');
            }
        });

        const nodeEl = nodeEnter.merge(nodeSelection as any);

        // Update Tick Function
        simulation.on('tick', () => {
            // Apply Manual Gravity towards parent
            nodes.forEach((d: any) => {
                if (d.parentId && d.parentId !== '/') {
                    const parent = nodes.find(n => n.id === d.parentId) as any;
                    if (parent) {
                        d.vx += (parent.x - d.x) * 0.04;
                        d.vy += (parent.y - d.y) * 0.04;
                    }
                }
            });

            linkPath.attr('d', (d: any) => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`);
            nodeEl.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
        });
        
        simulation.on('end', () => {
            // Auto-save positions when simulation settles
            savePositions(simulation.nodes());
        });

        // Update Visual Styles (for both new and existing nodes)
        nodeEl.each(function(d: any) {
            const el = d3.select(this);
            const nodeIssues = [
                ...(data.errors.filter(e => e.nodeId === d.id)),
                ...(data.conflicts.filter(c => c.nodeId === d.id))
            ];

            if (d.type === WiddxNodeType.FOLDER) {
                el.select('.folder-zone').attr('stroke', activeTheme.FOLDER + '33');
                el.select('.folder-body').attr('fill', activeTheme.FOLDER).attr('stroke', activeTheme.FOLDER_STROKE);
                el.select('.folder-tab').attr('fill', activeTheme.FOLDER_STROKE);
                el.select('.node-label').attr('fill', activeTheme.TEXT);
            } else {
                let color = activeTheme.CORE;
                let glowColor = 'none';
                let strokeWidth = 1;
                
                // Active Protocol Violation Logic (Visual Protocol Feedback)
                const isProtocolViolation = data.errors.some(e => e.nodeId === d.id && e.type === 'PROTOCOL_VIOLATION');

                if (d.type === WiddxNodeType.MISSING) {
                  color = activeTheme.MISSING;
                  glowColor = activeTheme.MISSING + '44';
                  strokeWidth = 2;
                } else if (isProtocolViolation) {
                  // Protocol Violation -> Magenta/Pink Pulse with Thick Ring
                  color = '#d946ef'; 
                  glowColor = '#d946ef66';
                  strokeWidth = 3;
                } else if (nodeIssues.length > 0) {
                  const worstIssue = data.errors.some(e => e.nodeId === d.id) ? 'ERROR' : 'CONFLICT';
                  color = worstIssue === 'ERROR' ? activeTheme.MISSING : '#a855f7'; 
                  glowColor = color + '66';
                  strokeWidth = 2;
                } else if (d.name.match(/\.(tsx?|jsx?)$/)) {
                  color = d.name.match(/x$/) ? activeTheme.UI : activeTheme.LOGIC;
                  strokeWidth = d.status === 'VALID' ? 2 : 1;
                }

                el.select('.issue-glow')
                    .attr('fill', glowColor)
                    .attr('opacity', glowColor === 'none' ? 0 : 1)
                    // Toggle Pulse Animation based on Protocol Violation
                    .attr('class', isProtocolViolation ? 'issue-glow animate-pulse-slow' : 'issue-glow');
                    
                el.select('.file-card')
                    .attr('fill', activeTheme.BG)
                    .attr('stroke', color)
                    .attr('stroke-width', strokeWidth);
                    
                el.select('.file-tag').attr('fill', color);
                el.select('.node-label').attr('fill', activeTheme.TEXT);
            }
        });

        return () => { simulation.stop(); };
    }, [nodes, links, dimensions, activeTheme]);

    // Focus/Isolation Effect with Directional Logic (Kept outside main render to avoid sim restarts)
    useEffect(() => {
        if (!svgSelection.current) return;
        
        const svg = svgSelection.current;
        const nodeEl = svg.selectAll('.node-element');
        const linkPath = svg.selectAll('.link-path');

        if (focusedNodeId) {
            const activeNodes = new Set<string>();
            activeNodes.add(focusedNodeId);

            if (highlightMode === 'omni' || highlightMode === 'downstream') {
                outboundMap.current.get(focusedNodeId)?.forEach(target => activeNodes.add(target));
            }
            if (highlightMode === 'omni' || highlightMode === 'upstream') {
                inboundMap.current.get(focusedNodeId)?.forEach(source => activeNodes.add(source));
            }

            nodeEl.transition().duration(400)
                .style('opacity', (d: any) => activeNodes.has(d.id) ? 1 : 0.05)
                .style('filter', (d: any) => activeNodes.has(d.id) ? 'none' : 'grayscale(100%) blur(1px)');
            
            linkPath.transition().duration(400)
                .style('opacity', (d: any) => {
                    const isDirect = (d.source.id === focusedNodeId && activeNodes.has(d.target.id)) || 
                                     (d.target.id === focusedNodeId && activeNodes.has(d.source.id));
                    return isDirect ? 1 : 0.05;
                });
        } else {
            nodeEl.transition().duration(400).style('opacity', 1).style('filter', 'none');
            linkPath.transition().duration(400).style('opacity', 1);
        }

    }, [focusedNodeId, highlightMode]);

    // Force Update Effect (Simulation & Theme & Active State)
    useEffect(() => {
        if (!simulationRef.current || !svgSelection.current) return;
        const sim = simulationRef.current;
        const svg = svgSelection.current;

        sim.force('link', d3.forceLink(links)
            .id((d: any) => d.id)
            .distance((d: any) => (d.type === 'STRUCTURE' ? 120 : 250) * config.spacing) 
            .strength((d: any) => (d.type === 'STRUCTURE' ? 0.5 : 0.05)) 
        );

        if (config.isPaused || !isActive) sim.stop(); else sim.alpha(0.3).restart();

        svg.selectAll('.link-path').attr('stroke', (d: any) => d.type === 'STRUCTURE' ? activeTheme.LINK_STRUC : activeTheme.LINK_DEP)
            .attr('stroke-width', (d: any) => d.type === 'STRUCTURE' ? 1.5 : 1)
            .attr('marker-end', (d: any) => d.type === 'STRUCTURE' ? '' : (d.isBroken ? 'url(#arrow-error)' : 'url(#arrow-electric)'));

    }, [config, links, activeTheme, isActive]);

    // Debounced Save Helper
    const savePositions = (nodes: any[]) => {
        const positions: Record<string, {x: number, y: number}> = {};
        nodes.forEach(n => {
            if (n.x && n.y) positions[n.id] = { x: n.x, y: n.y };
        });
        if (projectId) {
            StorageService.saveUiState(projectId, 'graph_positions', positions);
        }
    };

    // Return nodes so parent can use them for minimap
    return { 
        config, setConfig, 
        handleZoom: (k: number) => svgSelection.current?.transition().duration(300).call(zoomBehavior.current!.scaleBy, k),
        handleReset: () => svgSelection.current?.transition().duration(500).call(zoomBehavior.current!.transform, d3.zoomIdentity.translate(dimensions.width/2, dimensions.height/2).scale(0.35)),
        nodes // Expose node positions
    };
};