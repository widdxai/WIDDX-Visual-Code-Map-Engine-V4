import { WiddxFileEntry, WiddxGraph } from '../../types';
import { ProtocolEngine, WiddxProtocolType } from '../widdxProtocols';
import { widdxDeepScanProject, widdxDetectMetadata } from '../widdxAnalysisUtils';
import { GraphBuilder } from './graphBuilder';
import { GraphTraversal } from './graphTraversal';
import { QualityAuditor } from './qualityAuditor';
import { ProjectIndexer } from './projectIndexer';

export interface EngineContext {
    files: WiddxFileEntry[];
    fileMap: Map<string, string>;
    fileSet: Set<string>;
}

export class AnalysisPipeline {
    
    public static async execute(files: WiddxFileEntry[], overrideProtocols?: WiddxProtocolType[]): Promise<WiddxGraph> {
        // 0. Context Initialization
        const fileMap = new Map<string, string>();
        const fileSet = new Set<string>();
        
        files.forEach(f => {
            const path = f.path.startsWith('/') ? f.path : '/' + f.path;
            fileMap.set(path, f.content);
            fileSet.add(path);
        });

        const allPaths = Array.from(fileSet);

        // 1. Intelligence Phase: Protocol & Metadata Detection
        // Use overrides if provided, otherwise detect.
        const activeProtocols = (overrideProtocols && overrideProtocols.length > 0)
            ? overrideProtocols 
            : ProtocolEngine.detectProtocols(files);
        
        // Pass all active protocols for metadata detection
        const { language, framework, entryPoint } = widdxDetectMetadata(allPaths, fileMap, activeProtocols);
        const manifest = widdxDeepScanProject(fileMap, entryPoint);

        // 2. Construction Phase: Graph Builder
        const { nodes, edges, errors, adjacencyList, folderPaths } = GraphBuilder.build(fileMap, fileSet, activeProtocols);

        // 3. Traversal Phase: Reachability & Cycle Detection
        GraphTraversal.markReachability(nodes, adjacencyList, entryPoint);
        
        const circularLoops = GraphTraversal.detectCircularDependencies(adjacencyList);
        circularLoops.forEach(loop => {
            const msg = `Circular Dependency: ${loop.join(' -> ')}`;
            errors.push({
                id: `err-circular-${Math.random()}`,
                severity: 'ERROR',
                type: 'CIRCULAR',
                message: msg,
                nodeId: loop[0]
            });
        });

        // 4. Audit Phase: Quality & Orphans
        const audit = QualityAuditor.runStaticAnalysis(nodes, activeProtocols);
        const { warnings, conflicts } = audit;
        // Merge Protocol Violations into the main errors array
        errors.push(...audit.errors);

        // 5. Indexing Phase: Semantic Symbol Extraction
        const index = ProjectIndexer.buildIndex(nodes);

        // 6. Final Assembly
        const defaultOpenFolders = new Set<string>(['/']); 
        folderPaths.forEach(fp => defaultOpenFolders.add(fp));

        return {
            widdxMeta: {
                product: "WIDDX Visual Development Environment",
                language,
                framework,
                protocols: activeProtocols, // Store all detected protocols
                entry: entryPoint,
                defaultOpenFolders: Array.from(defaultOpenFolders),
                manifest
            },
            nodes,
            edges,
            flows: [],
            warnings,
            errors,
            conflicts,
            virtualFileSystem: files,
            index,
            version: 1,
            lastFullAnalysis: Date.now()
        };
    }
}