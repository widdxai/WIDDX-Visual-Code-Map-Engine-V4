import { WiddxGraph, WiddxFileEntry, WiddxNodeType } from '../../types';
import { FileProcessor } from './fileProcessor';
import { DependencyResolver } from './dependencyResolver';
import { QualityAuditor } from './qualityAuditor';
import { widdxResolvePath, widdxExtractPathMappings } from '../widdxAnalysisUtils';
import { GraphDiff } from './graphReducer';

export class GraphPatcher {
    public static createDiff(
        currentGraph: WiddxGraph, 
        mutation: { action: 'UPDATE' | 'CREATE' | 'DELETE', file: WiddxFileEntry }
    ): GraphDiff {
        const diff: GraphDiff = {
            addedNodes: [],
            updatedNodes: [],
            removedNodeIds: [],
            addedEdges: [],
            removedEdges: [],
            addedIssues: [],
            removedIssueIds: [],
            fileSystemOps: [mutation]
        };

        const targetNodeId = mutation.file.path.startsWith('/') ? mutation.file.path : '/' + mutation.file.path;

        if (mutation.action === 'DELETE') {
            diff.removedNodeIds?.push(targetNodeId);
            const connectedEdges = currentGraph.edges.filter(e => e.source === targetNodeId || e.target === targetNodeId);
            diff.removedEdges = connectedEdges;
            return diff;
        }

        // UPDATE or CREATE
        const tempMap = new Map([[targetNodeId, mutation.file.content]]);
        const { nodes: newNodesData } = FileProcessor.createNodesFromFiles(tempMap);
        const processedNode = newNodesData[0];

        // Determine if update or create for node list
        const existingNode = currentGraph.nodes.find(n => n.id === targetNodeId);
        if (existingNode) {
            diff.updatedNodes?.push({ ...existingNode, ...processedNode, content: mutation.file.content });
        } else {
            diff.addedNodes?.push(processedNode);
        }

        // Minimal fileMap reconstruction for resolving
        const fileMap = new Map<string, string>();
        const fileSet = new Set<string>();
        currentGraph.virtualFileSystem.forEach(f => {
             const p = f.path.startsWith('/') ? f.path : '/' + f.path;
             if (p !== targetNodeId) {
                fileMap.set(p, f.content);
                fileSet.add(p);
             }
        });
        fileMap.set(targetNodeId, mutation.file.content);
        fileSet.add(targetNodeId);

        const activeProtocols = currentGraph.widdxMeta.protocols || ['UNIVERSAL'];

        const { edges: newEdges, errors: newErrors, missingNodes } = DependencyResolver.buildEdges(
            [processedNode],
            fileMap, 
            fileSet, 
            new Set([...currentGraph.nodes.map(n => n.id), targetNodeId]), 
            activeProtocols
        );

        // Remove old outgoing edges
        const oldOutgoing = currentGraph.edges.filter(e => e.source === targetNodeId);
        diff.removedEdges?.push(...oldOutgoing);
        diff.addedEdges?.push(...newEdges);

        // Add newly discovered Missing Nodes
        const existingNodeIds = new Set(currentGraph.nodes.map(n => n.id));
        missingNodes.forEach(mn => {
            if (!existingNodeIds.has(mn.id)) diff.addedNodes?.push(mn);
        });

        // Audit with Active Protocols
        const audit = QualityAuditor.runStaticAnalysis([processedNode], activeProtocols);
        const oldIssues = [...currentGraph.errors, ...currentGraph.warnings, ...currentGraph.conflicts]
            .filter(i => i.nodeId === targetNodeId);
        diff.removedIssueIds?.push(...oldIssues.map(i => i.id));
        
        // Merge all issue types including new Protocol Violations (errors)
        diff.addedIssues?.push(...audit.warnings, ...audit.conflicts, ...audit.errors);

        // SELF-HEALING: Check incoming edges to missing nodes that might be fixed by this new file
        const pathMappings = widdxExtractPathMappings(fileMap);
        const brokenEdges = currentGraph.edges.filter(e => e.target.startsWith('MISSING:'));
        
        brokenEdges.forEach(edge => {
            const missingIdRaw = edge.target.replace('MISSING:', '');
            const resolved = widdxResolvePath(edge.source, missingIdRaw, fileSet, false, pathMappings);
            if (resolved === targetNodeId) {
                // We found a fix for a broken edge. 
                // Remove the broken edge and add a valid one.
                diff.removedEdges?.push(edge);
                diff.addedEdges?.push({ source: edge.source, target: targetNodeId, type: edge.type });
            }
        });

        return diff;
    }
}