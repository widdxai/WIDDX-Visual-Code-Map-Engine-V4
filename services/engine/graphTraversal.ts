
import { WiddxNode, WiddxFlowStatus } from '../../types';

export class GraphTraversal {
    
    /**
     * Performs a Breadth-First Search (BFS) to mark reachable nodes from the entry point.
     * Updates node status to VALID if they are reachable.
     * 
     * OPTIMIZATION: 
     * 1. Uses a Node Map for O(1) lookup.
     * 2. Checks visitation BEFORE pushing to queue to keep memory footprint minimal.
     */
    public static markReachability(nodes: WiddxNode[], adjacencyList: Map<string, string[]>, entryPoint: string) {
        // Optimization: Create a fast lookup map
        const nodeMap = new Map<string, WiddxNode>();
        nodes.forEach(n => nodeMap.set(n.id, n));

        const visited = new Set<string>();
        
        // Initial setup
        const queue: string[] = [];
        
        if (entryPoint && nodeMap.has(entryPoint)) {
            queue.push(entryPoint);
            visited.add(entryPoint);
            const entryNode = nodeMap.get(entryPoint);
            if (entryNode) entryNode.status = WiddxFlowStatus.VALID;
        }

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;
            
            // Mark current as valid (redundant check for safety, but primary logic is on push)
            const node = nodeMap.get(current);
            if (node) node.status = WiddxFlowStatus.VALID;
            
            const neighbors = adjacencyList.get(current) || [];
            
            for (const n of neighbors) {
                if (!visited.has(n)) {
                    visited.add(n); // Mark immediately to prevent duplicates in queue
                    queue.push(n);
                    
                    // Mark status immediately to reflect reachability even if we don't process children yet
                    const neighborNode = nodeMap.get(n);
                    if (neighborNode) neighborNode.status = WiddxFlowStatus.VALID;
                }
            }
        }
    }

    /**
     * Detects circular dependencies using Depth-First Search (DFS).
     * Returns an array of cycles (paths).
     */
    public static detectCircularDependencies(adjacencyList: Map<string, string[]>): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recStack = new Set<string>();
        const path: string[] = [];

        const findCycles = (u: string) => {
            visited.add(u);
            recStack.add(u);
            path.push(u);
            
            const neighbors = adjacencyList.get(u) || [];
            for (const v of neighbors) {
                if (!visited.has(v)) {
                    findCycles(v);
                } else if (recStack.has(v)) {
                    const cycleStartIndex = path.indexOf(v);
                    if (cycleStartIndex !== -1) {
                        // Cloning the cycle path to avoid reference issues
                        cycles.push([...path.slice(cycleStartIndex), v]);
                    }
                }
            }
            
            recStack.delete(u);
            path.pop();
        };

        Array.from(adjacencyList.keys()).forEach(node => {
            if (!visited.has(node)) findCycles(node);
        });
        
        return cycles;
    }
}
