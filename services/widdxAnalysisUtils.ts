
// ... imports ...
import { WiddxGraph, WiddxNodeType, WiddxFlowStatus, WiddxProjectManifest } from '../types';

export type WiddxPathMappings = Record<string, string[]>;

export const WIDDX_SUPPORTED_EXTENSIONS = {
  JS: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  PYTHON: ['.py'],
  CSS: ['.css', '.scss', '.less'],
  JSON: ['.json'],
  HTML: ['.html', '.htm']
};

export const WIDDX_PYTHON_IMPORT_PATTERNS = [
    /from\s+([\w.]+)\s+import/g,
    /^import\s+([\w.]+)/gm
];
  
export function widdxGetLanguageFromPath(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
    if (lower.endsWith('.html')) return 'html';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.md')) return 'markdown';
    return 'text';
}

function stripJsonComments(jsonString: string): string {
    return jsonString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
}

export function widdxExtractPathMappings(fileMap: Map<string, string>): WiddxPathMappings {
    const mappings: WiddxPathMappings = {};
    const configFiles = ['/tsconfig.json', '/jsconfig.json'];
    
    for (const file of configFiles) {
        const content = fileMap.get(file);
        if (content) {
            try {
                const cleanContent = stripJsonComments(content);
                const json = JSON.parse(cleanContent);
                const paths = json.compilerOptions?.paths;
                if (paths) {
                    Object.assign(mappings, paths);
                }
            } catch (e) {
                console.warn(`Failed to parse ${file}:`, e);
            }
        }
    }
    return mappings;
}

export function widdxResolvePath(
    currentPath: string, 
    importPath: string, 
    allFiles: Set<string>, 
    isRelativeContext: boolean = false,
    pathMappings?: WiddxPathMappings
): string | null {
    if (importPath.match(/^(https?:|\/\/)/)) return 'EXTERNAL:' + importPath;

    let target = importPath;
    let wasMapped = false;

    if (pathMappings) {
        for (const alias in pathMappings) {
            const aliasBase = alias.replace('/*', '');
            if (target.startsWith(aliasBase)) {
                const replacements = pathMappings[alias];
                if (replacements && replacements.length > 0) {
                    const replacement = replacements[0].replace('/*', '');
                    target = target.replace(aliasBase, replacement);
                    if (!target.startsWith('/') && !target.startsWith('.')) {
                        target = '/' + target;
                    }
                    wasMapped = true;
                    break;
                }
            }
        }
    }

    if (!isRelativeContext && !target.startsWith('.') && !target.startsWith('/')) {
        if (target.startsWith('@') || target.startsWith('~')) {
             return null; 
        }
        return 'EXTERNAL:' + target;
    }

    if (isRelativeContext && !target.startsWith('.') && !target.startsWith('/')) {
        target = './' + target;
    }
  
    const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
    
    let parts = currentDir.split('/').filter(Boolean);
    if (target.startsWith('/')) {
        parts = target.split('/').filter(Boolean);
    } else {
        const importParts = target.split('/');
        for (const part of importParts) {
            if (part === '.' || part === '') continue;
            if (part === '..') parts.pop();
            else parts.push(part);
        }
    }
  
    const resolvedBase = '/' + parts.join('/');

    if (allFiles.has(resolvedBase)) return resolvedBase;

    for (const ext of [...WIDDX_SUPPORTED_EXTENSIONS.JS, ...WIDDX_SUPPORTED_EXTENSIONS.PYTHON, ...WIDDX_SUPPORTED_EXTENSIONS.CSS]) {
      if (allFiles.has(resolvedBase + ext)) return resolvedBase + ext;
    }

    for (const ext of [...WIDDX_SUPPORTED_EXTENSIONS.JS, ...WIDDX_SUPPORTED_EXTENSIONS.PYTHON]) {
      if (allFiles.has(resolvedBase + '/index' + ext)) return resolvedBase + '/index' + ext;
    }

    return null;
}

export function widdxFindImportsInAst(ast: any): string[] {
    const imports: string[] = [];
    if (!ast?.program?.body) return imports;
    for (const node of ast.program.body) {
      if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source?.value) {
          imports.push(node.source.value);
      }
    }
    return imports;
}

export function widdxParseFallbackImports(content: string): string[] {
    const imports = new Set<string>();
    const staticRegex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = staticRegex.exec(content)) !== null) imports.add(match[1]);
    while ((match = requireRegex.exec(content)) !== null) imports.add(match[1]);
    while ((match = dynamicRegex.exec(content)) !== null) imports.add(match[1]);

    return Array.from(imports);
}

export function widdxParseHtmlDependencies(content: string): string[] {
    const deps: string[] = [];
    const scriptRegex = /<script.*?src=["'](.+?)["']/g;
    const linkRegex = /<link.*?href=["'](.+?)["']/g;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    while ((match = linkRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    return deps;
}

export function widdxParseChromeManifest(content: string): string[] {
    const deps: string[] = [];
    try {
        const json = JSON.parse(stripJsonComments(content));
        if (json.background?.service_worker) deps.push(json.background.service_worker);
        if (json.background?.page) deps.push(json.background.page);
        if (json.background?.scripts) deps.push(...json.background.scripts);
        if (json.action?.default_popup) deps.push(json.action.default_popup);
        if (json.browser_action?.default_popup) deps.push(json.browser_action.default_popup);
        if (json.page_action?.default_popup) deps.push(json.page_action.default_popup);
        if (json.options_page) deps.push(json.options_page);
        if (json.options_ui?.page) deps.push(json.options_ui.page);
        if (json.side_panel?.default_path) deps.push(json.side_panel.default_path);
        if (json.devtools_page) deps.push(json.devtools_page);
        if (json.sandbox?.pages) deps.push(...json.sandbox.pages);
        if (json.content_scripts) {
            json.content_scripts.forEach((cs: any) => {
                if (cs.js) deps.push(...cs.js);
                if (cs.css) deps.push(...cs.css);
            });
        }
        if (json.icons) Object.values(json.icons).forEach((icon: any) => deps.push(icon));
        if (json.action?.default_icon) {
             if (typeof json.action.default_icon === 'string') deps.push(json.action.default_icon);
             else Object.values(json.action.default_icon).forEach((icon: any) => deps.push(icon));
        }
        if (json.web_accessible_resources) {
            json.web_accessible_resources.forEach((res: any) => {
                if (typeof res === 'string') deps.push(res);
                else if (res.resources) deps.push(...res.resources);
            });
        }
    } catch (e) {}
    return deps;
}

export function widdxDeepScanProject(fileMap: Map<string, string>, entryPoint: string): WiddxProjectManifest {
    const dependencies: Record<string, string> = {};
    const stack = new Set<string>();
    let architecture: WiddxProjectManifest['detectedArchitecture'] = 'UNKNOWN';
    let totalLines = 0;
    
    const pkgPath = Array.from(fileMap.keys()).find(k => k.endsWith('/package.json'));
    if (pkgPath) {
        try {
            const pkg = JSON.parse(fileMap.get(pkgPath) || '{}');
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            Object.keys(allDeps).forEach(dep => {
                dependencies[dep] = allDeps[dep];
                if (dep.includes('react')) stack.add('React');
                if (dep.includes('vue')) stack.add('Vue');
                if (dep.includes('angular')) stack.add('Angular');
                if (dep.includes('next')) stack.add('Next.js');
                if (dep.includes('tailwindcss')) stack.add('Tailwind');
                if (dep.includes('redux') || dep.includes('zustand')) stack.add('State Management');
                if (dep.includes('laravel')) stack.add('Laravel');
            });
        } catch (e) {}
    }

    fileMap.forEach((content, path) => {
        totalLines += content.split('\n').length;
        if (path.endsWith('.ts') || path.endsWith('.tsx')) stack.add('TypeScript');
        if (path.endsWith('.py')) stack.add('Python');
        if (path.endsWith('.php')) stack.add('PHP');

        if (path.includes('/controllers/') || path.includes('/models/') || path.includes('/views/')) {
            architecture = 'MVC';
        } else if (path.includes('/atoms/') || path.includes('/molecules/') || path.includes('/organisms/')) {
            architecture = 'ATOMIC';
        } else if (content.includes('dispatcher') || content.includes('payload') || content.includes('reducer')) {
            if (architecture === 'UNKNOWN') architecture = 'FLUX';
        }
    });

    if (architecture === 'UNKNOWN' && stack.has('React')) architecture = 'MODULAR';

    const complexityScore = Math.floor(totalLines / 100) + Object.keys(dependencies).length;

    return {
        name: pkgPath ? 'Project' : 'Untitled',
        technologyStack: Array.from(stack),
        externalDependencies: dependencies,
        detectedArchitecture: architecture,
        entryPoint,
        totalLinesOfCode: totalLines,
        complexityScore
    };
}

export function widdxSerializeGraphForAi(graph: WiddxGraph): string {
    const manifest = graph.widdxMeta.manifest;
    
    // --- TOPOLOGY AWARENESS: Degree Centrality Calculation ---
    const incomingMap = new Map<string, number>();
    graph.edges.forEach(e => {
        incomingMap.set(e.target, (incomingMap.get(e.target) || 0) + 1);
    });

    // --- INTELLIGENCE INJECTION: CRITICAL CONFIG FILES ---
    let configContext = "";
    const criticalConfigs = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'tailwind.config.js', 'manifest.json'];
    
    // Truncate config content to prevent massive overflow
    graph.nodes.forEach(n => {
        const fileName = n.name.toLowerCase();
        if (n.type === WiddxNodeType.FILE && criticalConfigs.some(c => fileName.endsWith(c))) {
            const content = n.content?.substring(0, 2000) || "";
            configContext += `\n=== CONFIG: ${n.id} ===\n${content}\n`;
        }
    });

    // --- CONTEXT PRUNING STRATEGY ---
    const ignoredDirs = ['/node_modules', '/.git', '/dist', '/build', '/coverage', '/.vscode', '/public'];
    
    const relevantFiles = graph.nodes.filter(n => {
        if (n.type !== WiddxNodeType.FILE) return false;
        
        // Skip hidden files
        if (n.name.startsWith('.')) return false;

        if (!n.id.includes('/', 1)) return true; // Keep root files
        
        for (const dir of ignoredDirs) {
            if (n.id.startsWith(dir)) return false;
        }
        return true;
    });

    // Limit relevant files list to prevent token explosion
    const truncatedFiles = relevantFiles.slice(0, 200);
    const hiddenCount = Math.max(0, relevantFiles.length - 200);

    const issues = [...graph.errors, ...graph.conflicts, ...graph.warnings];

    // --- SEMANTIC INDEX (Pruned) ---
    let symbolMapContext = "SEMANTIC INDEX (Major Definitions):\n";
    let indexCount = 0;
    
    if (graph.index && graph.index.files) {
        graph.index.files.forEach((exports, fileId) => {
            if (relevantFiles.some(f => f.id === fileId) && exports.length > 0 && indexCount < 50) {
                const symbols = exports.slice(0, 10).map(symName => {
                    const symDetails = graph.index.symbols.get(symName)?.find(s => s.fileId === fileId);
                    return symDetails ? `${symName}(${symDetails.kind})` : symName;
                }).join(', ');
                
                symbolMapContext += `File: ${fileId} -> Exports: [${symbols}]\n`;
                indexCount++;
            }
        });
    }

    return `
=== PROJECT INTELLIGENCE REPORT ===
LANGUAGE: ${graph.widdxMeta.language}
FRAMEWORK: ${graph.widdxMeta.framework}
ARCHITECTURE: ${manifest.detectedArchitecture}
LINES OF CODE: ${manifest.totalLinesOfCode}

${configContext ? `=== DETECTED CONFIGURATION (READ-ONLY MEMORY) ===${configContext}` : ''}

${symbolMapContext}

=== FILE SYSTEM SNAPSHOT (SOURCE CODE ONLY, MAX 200 FILES) ===
${truncatedFiles.map(f => {
    // --- TOPOLOGY AWARENESS: High Impact Annotation ---
    const dependents = incomingMap.get(f.id) || 0;
    const impactTag = dependents > 5 ? ` [HIGH IMPACT: ${dependents} dependents]` : '';
    return `- ${f.id} (${f.size} lines)${impactTag} [${f.status}]`;
}).join('\n')}
${hiddenCount > 0 ? `... and ${hiddenCount} more files (hidden for brevity).` : ''}

*Note: 'node_modules' exists but is hidden to save context. Assume standard imports work.*

SYSTEM HEALTH DIAGNOSTICS:
${issues.slice(0, 15).map(i => `[${i.severity}] ${i.message} (Node: ${i.nodeId})`).join('\n') || "No critical issues detected."}
`.trim();
}

export function widdxDetectMetadata(allPaths: string[], fileMap: Map<string, string>, protocols: string[]) {
    let language = 'Unknown';
    let framework = 'None';
    let entryPoint = '';

    if (allPaths.some(p => p.endsWith('.ts') || p.endsWith('.tsx'))) language = 'TypeScript';
    else if (allPaths.some(p => p.endsWith('.js') || p.endsWith('.jsx'))) language = 'JavaScript';
    else if (allPaths.some(p => p.endsWith('.php'))) language = 'PHP';
    else if (allPaths.some(p => p.endsWith('.py'))) language = 'Python';

    // Framework detection based on Protocols
    if (protocols.includes('CHROME_EXT_V3')) {
        framework = 'Chrome Extension (MV3)';
        entryPoint = allPaths.find(p => p.endsWith('/manifest.json')) || '';
    } else if (protocols.includes('LARAVEL_MVC')) {
        framework = 'Laravel';
        entryPoint = allPaths.find(p => p.endsWith('/artisan') || p.endsWith('/public/index.php')) || '';
    } else if (protocols.includes('REACT_MODERN')) {
        framework = 'React';
    } else {
        const pkgPath = allPaths.find(p => p.endsWith('/package.json'));
        if (pkgPath) {
            const content = fileMap.get(pkgPath) || '';
            if (content.includes('"react"')) framework = 'React';
            else if (content.includes('"vue"')) framework = 'Vue';
            else framework = 'Node.js';
        }
    }

    if (!entryPoint) {
        const candidates = ['index.tsx', 'index.ts', 'index.js', 'main.py', 'app.py', 'background.js', 'server.js', 'index.php'];
        for (const cand of candidates) {
            const found = allPaths.find(p => p.endsWith('/' + cand));
            if (found) { entryPoint = found; break; }
        }
    }
    
    if (!entryPoint && allPaths.length > 0) entryPoint = allPaths[0];
    return { language, framework, entryPoint };
}
