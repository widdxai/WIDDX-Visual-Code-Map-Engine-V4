import { WiddxGraph, WiddxNode, WiddxEdge, WiddxIssue, WiddxFileEntry } from '../../types';
import { ProjectIndexer } from './projectIndexer';

export interface GraphDiff {
    addedNodes?: WiddxNode[];
    updatedNodes?: WiddxNode[];
    removedNodeIds?: string[];
    addedEdges?: WiddxEdge[];
    removedEdges?: WiddxEdge[];
    addedIssues?: WiddxIssue[];
    removedIssueIds?: string[];
    fileSystemOps?: { action: 'UPDATE' | 'CREATE' | 'DELETE', file: WiddxFileEntry }[];
}

export class GraphReducer {
    public static apply(graph: WiddxGraph, diff: GraphDiff): WiddxGraph {
        let nodes = [...graph.nodes];
        let edges = [...graph.edges];
        let errors = [...graph.errors];
        let warnings = [...graph.warnings];
        let conflicts = [...graph.conflicts];
        let vfs = [...graph.virtualFileSystem];

        // 1. Nodes
        if (diff.removedNodeIds) {
            const set = new Set(diff.removedNodeIds);
            nodes = nodes.filter(n => !set.has(n.id));
        }
        if (diff.updatedNodes) {
            const map = new Map(diff.updatedNodes.map(n => [n.id, n]));
            nodes = nodes.map(n => map.has(n.id) ? map.get(n.id)! : n);
        }
        if (diff.addedNodes) {
            nodes.push(...diff.addedNodes);
        }

        // 2. Edges
        if (diff.removedEdges) {
            const removeSet = new Set(diff.removedEdges.map(e => `${e.source}|${e.target}`));
            edges = edges.filter(e => !removeSet.has(`${e.source}|${e.target}`));
        }
        if (diff.addedEdges) {
            edges.push(...diff.addedEdges);
        }

        // 3. Issues
        if (diff.removedIssueIds) {
            const set = new Set(diff.removedIssueIds);
            errors = errors.filter(i => !set.has(i.id));
            warnings = warnings.filter(i => !set.has(i.id));
            conflicts = conflicts.filter(i => !set.has(i.id));
        }
        if (diff.addedIssues) {
            diff.addedIssues.forEach(i => {
                if (i.severity === 'ERROR' || i.type === 'BROKEN_IMPORT') errors.push(i);
                else if (i.severity === 'WARNING') warnings.push(i);
                else conflicts.push(i);
            });
        }

        // 4. VFS
        if (diff.fileSystemOps) {
            diff.fileSystemOps.forEach(op => {
                if (op.action === 'DELETE') {
                    vfs = vfs.filter(f => f.path !== op.file.path);
                } else if (op.action === 'UPDATE') {
                    vfs = vfs.map(f => f.path === op.file.path ? op.file : f);
                } else if (op.action === 'CREATE') {
                    if (!vfs.find(f => f.path === op.file.path)) vfs.push(op.file);
                }
            });
        }

        // 5. Re-Index
        const index = ProjectIndexer.buildIndex(nodes);

        return {
            ...graph,
            nodes,
            edges,
            errors,
            warnings,
            conflicts,
            virtualFileSystem: vfs,
            index,
            version: (graph.version || 0) + 1
        };
    }
}