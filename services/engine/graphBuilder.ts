
import { WiddxNode, WiddxEdge, WiddxIssue } from '../../types';
import { FileProcessor } from './fileProcessor';
import { DependencyResolver } from './dependencyResolver';

export class GraphBuilder {
    /**
     * Coordinate raw file processing and dependency resolution to build graph primitives.
     */
    public static build(
        fileMap: Map<string, string>, 
        fileSet: Set<string>, 
        activeProtocols: string[]
    ): {
        nodes: WiddxNode[];
        edges: WiddxEdge[];
        errors: WiddxIssue[];
        adjacencyList: Map<string, string[]>;
        folderPaths: Set<string>;
    } {
        // 1. Convert Files to Nodes
        const { nodes, validNodeIds, folderPaths } = FileProcessor.createNodesFromFiles(fileMap);
        
        // 2. Resolve Dependencies (Edges)
        const { edges, errors, missingNodes, adjacencyList } = DependencyResolver.buildEdges(nodes, fileMap, fileSet, validNodeIds, activeProtocols);
        
        // 3. Merge Missing Nodes (Broken Links) into the main node list
        nodes.push(...missingNodes);

        return { nodes, edges, errors, adjacencyList, folderPaths };
    }
}
