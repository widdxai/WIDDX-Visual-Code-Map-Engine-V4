
import { WiddxNode, WiddxEdge, WiddxNodeType, WiddxFlowStatus, WiddxIssue } from '../../types';
import { 
  WIDDX_SUPPORTED_EXTENSIONS, 
  WIDDX_PYTHON_IMPORT_PATTERNS, 
  widdxResolvePath, 
  widdxParseHtmlDependencies, 
  widdxParseChromeManifest,
  widdxParseFallbackImports,
  widdxExtractPathMappings,
  WiddxPathMappings
} from '../widdxAnalysisUtils';

export class DependencyResolver {
    
    public static buildEdges(
        nodes: WiddxNode[], 
        fileMap: Map<string, string>, 
        fileSet: Set<string>,
        validNodeIds: Set<string>,
        activeProtocols: string[] // Changed from framework string
    ): { edges: WiddxEdge[], errors: WiddxIssue[], missingNodes: WiddxNode[], adjacencyList: Map<string, string[]> } {
        
        const edges: WiddxEdge[] = [];
        const errors: WiddxIssue[] = [];
        const missingNodes = new Map<string, WiddxNode>();
        const adjacencyList = new Map<string, string[]>();

        // Extract Path Mappings
        const pathMappings = widdxExtractPathMappings(fileMap);

        nodes.forEach(node => {
            if (node.type !== WiddxNodeType.FILE) return;
            
            const content = fileMap.get(node.id) || '';
            const imports = this.extractImports(node.id, content, activeProtocols);

            imports.forEach(imp => {
                // Determine edge type (Dynamic vs Static)
                const isDynamic = content.includes(`import('${imp}')`) || content.includes(`require('${imp}')`);
                const edgeType = isDynamic ? 'DYNAMIC' : 'IMPORT';

                // Handle Manifest V3 paths (relative to root usually)
                const isManifest = node.id.endsWith('/manifest.json');
                const isChromeExt = activeProtocols.includes('CHROME_EXT_V3');
                
                // For manifest.json, we treat imports as relative to the manifest file location
                const resolved = widdxResolvePath(node.id, imp, fileSet, isChromeExt || isManifest, pathMappings);
                
                if (resolved && !resolved.startsWith('EXTERNAL:')) {
                    if (validNodeIds.has(resolved)) {
                        edges.push({ source: node.id, target: resolved, type: edgeType });
                        if (!adjacencyList.has(node.id)) adjacencyList.set(node.id, []);
                        adjacencyList.get(node.id)?.push(resolved);
                    }
                } else if (!resolved) {
                    // Ignore obvious nodejs built-ins.
                    if (imp.startsWith('node:')) return;
                    
                    // HEURISTIC: What counts as a "Missing File" vs "External Library"?
                    // 1. Starts with ./ or ../ or / -> Definitely local
                    // 2. Starts with @/ or ~ -> Definitely local alias
                    // 3. Ends with a known file extension (.js, .css, etc) -> Likely a file reference (even if missing ./)
                    
                    const isExplicitLocal = imp.match(/^[\.\/@~]/);
                    const hasFileExt = imp.match(/\.(js|jsx|ts|tsx|css|scss|json|py|html|png|jpg|svg)$/);
                    
                    // If it looks like a package (e.g., 'react', 'axios') and has no extension, skip it.
                    if (!isExplicitLocal && !hasFileExt) return;

                    const missingId = `MISSING:${imp}`;
                    if (!missingNodes.has(missingId)) {
                        missingNodes.set(missingId, {
                            id: missingId,
                            name: imp + ' (Missing)',
                            type: WiddxNodeType.MISSING,
                            size: 0,
                            status: WiddxFlowStatus.BROKEN,
                            parentId: node.parentId
                        });
                    }
                    edges.push({ source: node.id, target: missingId, type: edgeType });
                    errors.push({
                        id: `err-broken-${Math.random().toString(36).substr(2, 5)}`,
                        severity: 'ERROR',
                        type: 'BROKEN_IMPORT',
                        message: `Broken Link: '${imp}' cannot be found.`,
                        nodeId: node.id
                    });
                }
            });
        });

        return { edges, errors, missingNodes: Array.from(missingNodes.values()), adjacencyList };
    }

    private static extractImports(path: string, content: string, activeProtocols: string[]): Set<string> {
        const imports = new Set<string>();
        const isJsTs = WIDDX_SUPPORTED_EXTENSIONS.JS.some(ext => path.endsWith(ext));
        const isPython = WIDDX_SUPPORTED_EXTENSIONS.PYTHON.some(ext => path.endsWith(ext));
        const isHtml = WIDDX_SUPPORTED_EXTENSIONS.HTML.some(ext => path.endsWith(ext));
        
        if (path.endsWith('/manifest.json') && activeProtocols.includes('CHROME_EXT_V3')) {
            widdxParseChromeManifest(content).forEach(ref => imports.add(ref));
        } else if (isHtml) {
            widdxParseHtmlDependencies(content).forEach(ref => imports.add(ref));
        } else if (isJsTs) {
            // Simplified: Use regex fallback for robustness against Script Errors in preview envs
            widdxParseFallbackImports(content).forEach(i => imports.add(i));
        } else if (isPython) {
            WIDDX_PYTHON_IMPORT_PATTERNS.forEach(regex => {
                let match;
                const r = new RegExp(regex);
                while ((match = r.exec(content)) !== null) if (match[1]) imports.add(match[1]);
            });
        }
        return imports;
    }
}
