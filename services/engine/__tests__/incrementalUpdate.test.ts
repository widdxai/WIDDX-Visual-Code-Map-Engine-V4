// @ts-nocheck
import { GraphPatcher } from '../graphPatcher';
import { GraphReducer } from '../graphReducer';
import { WiddxGraph, WiddxNodeType, WiddxFlowStatus } from '../../types';

describe('Graph Engine (Feature 6: Cold Start / AnalysisPipeline Refactor)', () => {

    const initialGraph: WiddxGraph = {
        widdxMeta: { 
            product: 'TEST', language: 'TS', framework: 'React', 
            protocols: ['UNIVERSAL'], entry: 'index.ts', defaultOpenFolders: [], 
            manifest: { name: 'test', technologyStack: [], externalDependencies: {}, detectedArchitecture: 'UNKNOWN', entryPoint: '', totalLinesOfCode: 0, complexityScore: 0 } 
        },
        nodes: [
            { id: '/index.ts', name: 'index.ts', type: WiddxNodeType.FILE, size: 10, status: WiddxFlowStatus.VALID, content: "import { func } from './utils';" },
            { id: '/utils.ts', name: 'utils.ts', type: WiddxNodeType.FILE, size: 5, status: WiddxFlowStatus.VALID, content: "export const func = () => {};" }
        ],
        edges: [
            { source: '/index.ts', target: '/utils.ts', type: 'IMPORT' }
        ],
        errors: [],
        warnings: [],
        conflicts: [],
        flows: [],
        virtualFileSystem: [
            { path: '/index.ts', content: "import { func } from './utils';" },
            { path: '/utils.ts', content: "export const func = () => {};" }
        ],
        index: { symbols: new Map(), files: new Map() },
        version: 1
    };

    it('should generate an O(1) Diff for a File Update', () => {
        const mutation = {
            action: 'UPDATE' as const,
            file: { path: '/utils.ts', content: "export const func = () => {}; export const newFunc = () => {};" }
        };

        const diff = GraphPatcher.createDiff(initialGraph, mutation);

        expect(diff.updatedNodes).toBeDefined();
        expect(diff.updatedNodes![0].id).toBe('/utils.ts');
        expect(diff.updatedNodes![0].content).toContain('newFunc');
        
        // Ensure we didn't accidentally regenerate the whole graph
        expect(diff.addedNodes?.length).toBe(0); 
    });

    it('should correctly Reducer applying a Diff', () => {
        const mutation = {
            action: 'CREATE' as const,
            file: { path: '/newFile.ts', content: "import { func } from './utils';" }
        };

        // 1. Create Diff
        const diff = GraphPatcher.createDiff(initialGraph, mutation);
        
        // 2. Apply Diff
        const newGraph = GraphReducer.apply(initialGraph, diff);

        // Assertions
        expect(newGraph.nodes.length).toBe(3);
        expect(newGraph.nodes.find(n => n.id === '/newFile.ts')).toBeDefined();
        
        // Check Edge Creation
        const newEdge = newGraph.edges.find(e => e.source === '/newFile.ts' && e.target === '/utils.ts');
        expect(newEdge).toBeDefined();

        // Check Version Increment
        expect(newGraph.version).toBe(2);
    });

    it('should detect Broken Links in new files (Incremental Resolution)', () => {
        const mutation = {
            action: 'CREATE' as const,
            file: { path: '/broken.ts', content: "import { missing } from './nowhere';" }
        };

        const diff = GraphPatcher.createDiff(initialGraph, mutation);
        const newGraph = GraphReducer.apply(initialGraph, diff);

        // Check for Missing Node creation
        const missingNode = newGraph.nodes.find(n => n.id === 'MISSING:/nowhere');
        expect(missingNode).toBeDefined();
        
        // Check for Error generation
        const error = newGraph.errors.find(e => e.nodeId === '/broken.ts');
        expect(error).toBeDefined();
        expect(error?.type).toBe('BROKEN_IMPORT');
    });
});