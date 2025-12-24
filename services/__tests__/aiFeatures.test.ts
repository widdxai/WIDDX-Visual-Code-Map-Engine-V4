// @ts-nocheck
import { widdxSerializeGraphForAi } from '../widdxAnalysisUtils';
import { WiddxGraph, WiddxNodeType, WiddxFlowStatus } from '../../types';

describe('AI Features (Features 4 & 7)', () => {

    describe('widdxSerializeGraphForAi (Topology Awareness)', () => {
        it('should annotate HIGH IMPACT nodes', () => {
            // Setup a graph where 'core.ts' has many dependents
            const nodes = [
                { id: 'core.ts', name: 'core.ts', type: WiddxNodeType.FILE, size: 100, status: WiddxFlowStatus.VALID },
                // 10 dependents
                ...Array.from({ length: 10 }).map((_, i) => ({
                    id: `comp${i}.ts`, name: `comp${i}.ts`, type: WiddxNodeType.FILE, size: 10, status: WiddxFlowStatus.VALID
                }))
            ];

            const edges = Array.from({ length: 10 }).map((_, i) => ({
                source: `comp${i}.ts`,
                target: 'core.ts', // All point to core
                type: 'IMPORT' as const
            }));

            const graph: WiddxGraph = {
                widdxMeta: { 
                    product: '', language: 'TS', framework: '', protocols: [], entry: '', defaultOpenFolders: [],
                    manifest: { detectedArchitecture: 'MODULAR', totalLinesOfCode: 200 } as any
                },
                nodes,
                edges,
                errors: [],
                warnings: [],
                conflicts: [],
                flows: [],
                virtualFileSystem: [],
                index: { symbols: new Map(), files: new Map() }
            };

            const output = widdxSerializeGraphForAi(graph);

            // Assert Topology Awareness
            expect(output).toContain('core.ts (100 lines) [HIGH IMPACT: 10 dependents]');
            // Others should not be high impact
            expect(output).not.toContain('comp0.ts (10 lines) [HIGH IMPACT');
        });

        it('should prune irrelevant folders from context', () => {
            const graph: WiddxGraph = {
                widdxMeta: { manifest: {} } as any,
                nodes: [
                    { id: '/src/main.ts', name: 'main.ts', type: WiddxNodeType.FILE, size: 10, status: WiddxFlowStatus.VALID },
                    { id: '/node_modules/pkg/index.js', name: 'index.js', type: WiddxNodeType.FILE, size: 10, status: WiddxFlowStatus.VALID }
                ],
                edges: [],
                errors: [],
                warnings: [],
                conflicts: [],
                flows: [],
                virtualFileSystem: [],
                index: { symbols: new Map(), files: new Map() }
            };

            const output = widdxSerializeGraphForAi(graph);
            
            expect(output).toContain('main.ts');
            expect(output).not.toContain('node_modules/pkg/index.js');
        });
    });
});