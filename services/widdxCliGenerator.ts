export const getCliScriptContent = (): string => {
  return `#!/usr/bin/env node

/**
 * WIDDX AUTONOMOUS CLI
 * --------------------
 * Runs WIDDX static analysis in a Node.js environment.
 * Generates a JSON report of the dependency graph and system integrity.
 * 
 * Usage: node widdx-cli.js [target_directory]
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2] || process.cwd();
const OUTPUT_FILE = 'widdx-report.json';

// --- CONFIGURATION ---
const IGNORE_DIRS = new Set(['node_modules', '.git', '.github', '.vscode', 'dist', 'build', 'coverage', '__tests__']);
const IGNORE_FILES = new Set(['.DS_Store', 'package-lock.json', 'yarn.lock']);
const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.json', '.html', '.css']);

// --- PATTERNS ---
const IMPORT_PATTERNS = {
  JS: [
    /import\\s+.*?\\s+from\\s+['"](.+?)['"]/g,             // import x from 'y'
    /export\\s+.*?\\s+from\\s+['"](.+?)['"]/g,             // export x from 'y'
    /require\\(['"](.+?)['"]\\)/g,                         // require('y')
    /import\\(['"](.+?)['"]\\)/g                           // dynamic import('y')
  ],
  PYTHON: [
    /from\\s+(\\.+[\\w\\.]*)\\s+import/g,                  // from .module import x
    /^import\\s+([\\w\\.]+)/gm                             // import module
  ],
  HTML: [
    /<script.*?src=["'](.+?)["']/g,                        // <script src="...">
    /<link.*?href=["'](.+?)["']/g                          // <link href="...">
  ]
};

// --- TYPES ---
const NodeType = { FILE: 'FILE', FOLDER: 'FOLDER', MISSING: 'MISSING' };
const FlowStatus = { VALID: 'VALID', BROKEN: 'BROKEN', ORPHAN: 'ORPHAN' };

console.log(\`\\x1b[36m[WIDDX] Initializing Autonomous Engine in: \\x1b[0m\${TARGET_DIR}\`);

// --- 1. FILE DISCOVERY ---
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (IGNORE_FILES.has(file)) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(file)) walkDir(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

const allFiles = walkDir(TARGET_DIR);
console.log(\`\\x1b[36m[WIDDX] Scanned \${allFiles.length} artifacts.\\x1b[0m\`);

// --- 2. NODE CREATION ---
const nodes = [];
const fileSet = new Set();
const idMap = new Map(); // Absolute path -> Relative ID

allFiles.forEach(absPath => {
  const relPath = '/' + path.relative(TARGET_DIR, absPath).replace(/\\\\/g, '/');
  fileSet.add(relPath);
  idMap.set(absPath, relPath);
  
  nodes.push({
    id: relPath,
    name: path.basename(relPath),
    type: NodeType.FILE,
    size: fs.statSync(absPath).size,
    status: FlowStatus.ORPHAN, // Will update later
    parentId: path.dirname(relPath) === '/' ? '/' : path.dirname(relPath)
  });
});

// --- 3. IMPORT RESOLUTION ---
const edges = [];
const missingNodes = new Map();
const errors = [];

function resolvePath(currentPath, importPath) {
  // External / Absolute (simple check)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;

  const currentDir = path.dirname(currentPath);
  const targetAbs = path.resolve(path.join(TARGET_DIR, currentDir), importPath);
  
  // Try Exact
  let candidateRel = '/' + path.relative(TARGET_DIR, targetAbs).replace(/\\\\/g, '/');
  if (fileSet.has(candidateRel)) return candidateRel;

  // Try Extensions
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (fileSet.has(candidateRel + ext)) return candidateRel + ext;
  }
  
  // Try Index
  for (const ext of SUPPORTED_EXTENSIONS) {
    const indexRel = candidateRel + '/index' + ext;
    if (fileSet.has(indexRel)) return indexRel;
  }

  return null; // External or Missing
}

allFiles.forEach(absPath => {
  const content = fs.readFileSync(absPath, 'utf-8');
  const relPath = idMap.get(absPath);
  const ext = path.extname(absPath).toLowerCase();

  let patterns = [];
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) patterns = IMPORT_PATTERNS.JS;
  else if (['.py'].includes(ext)) patterns = IMPORT_PATTERNS.PYTHON;
  else if (['.html', '.htm'].includes(ext)) patterns = IMPORT_PATTERNS.HTML;

  patterns.forEach(regex => {
    let match;
    // Reset regex state
    const r = new RegExp(regex); 
    while ((match = r.exec(content)) !== null) {
      const imp = match[1];
      if (!imp) continue;
      
      const resolved = resolvePath(relPath, imp);
      
      if (resolved) {
        edges.push({ source: relPath, target: resolved, type: 'IMPORT' });
      } else if (imp.startsWith('.') || imp.startsWith('/')) {
        // It's a local import but failed to resolve -> MISSING
        const missingId = \`MISSING:\${imp}\`;
        if (!missingNodes.has(missingId)) {
          missingNodes.set(missingId, {
            id: missingId,
            name: imp + ' (Missing)',
            type: NodeType.MISSING,
            status: FlowStatus.BROKEN
          });
          errors.push({
            severity: 'ERROR',
            message: \`Missing artifact: \${imp}\`,
            source: relPath
          });
        }
        edges.push({ source: relPath, target: missingId, type: 'IMPORT' });
      }
    }
  });
});

// --- 4. ORPHAN DETECTION ---
// Simple reachability from likely entry points
const likelyEntries = nodes.filter(n => 
  n.name.match(/^(index|main|app|server)\\.(js|ts|py|html)$/i) || 
  n.id.endsWith('package.json')
).map(n => n.id);

const visited = new Set(likelyEntries);
const queue = [...likelyEntries];

// Build adjacency
const adj = new Map();
edges.forEach(e => {
  if (!adj.has(e.source)) adj.set(e.source, []);
  adj.get(e.source).push(e.target);
});

while (queue.length > 0) {
  const curr = queue.shift();
  const neighbors = adj.get(curr) || [];
  neighbors.forEach(n => {
    if (!visited.has(n)) {
      visited.add(n);
      queue.push(n);
    }
  });
}

nodes.forEach(n => {
  if (visited.has(n.id)) n.status = FlowStatus.VALID;
  // Configs are usually valid
  if (n.name.includes('config') || n.name.startsWith('.')) n.status = FlowStatus.VALID;
});

// --- 5. REPORT GENERATION ---
const fullNodeList = [...nodes, ...missingNodes.values()];
const report = {
  timestamp: new Date().toISOString(),
  metrics: {
    files: nodes.length,
    edges: edges.length,
    missing: missingNodes.size,
    orphans: nodes.filter(n => n.status === FlowStatus.ORPHAN).length
  },
  errors: errors,
  graph: {
    nodes: fullNodeList,
    edges: edges
  }
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

console.log(\`\\x1b[32m[WIDDX] Analysis Complete.\`\\x1b[0m);
console.log(\`   - Files: \${report.metrics.files}\`);
console.log(\`   - Relations: \${report.metrics.edges}\`);
console.log(\`   - Broken Links: \${report.metrics.missing}\`);
console.log(\`   - Orphans: \${report.metrics.orphans}\`);

if (errors.length > 0) {
  console.log(\`\\n\\x1b[31m[FAIL] System Integrity Compromised. \${errors.length} broken flows detected.\\x1b[0m\`);
  process.exit(1);
} else {
  console.log(\`\\n\\x1b[32m[PASS] System Integrity Verified.\\x1b[0m\`);
  process.exit(0);
}
`;
};