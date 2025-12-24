import { WiddxNode, WiddxNodeType, WiddxIssue, WiddxFlowStatus, WiddxProtocolType } from '../../types';
import { ProtocolEngine } from '../widdxProtocols';

export class QualityAuditor {
    
    /**
     * Runs code quality heuristics and Active Protocol Enforcement.
     */
    public static runStaticAnalysis(nodes: WiddxNode[], activeProtocolIds: WiddxProtocolType[] = ['UNIVERSAL']): { warnings: WiddxIssue[], conflicts: WiddxIssue[], errors: WiddxIssue[] } {
        const warnings: WiddxIssue[] = [];
        const conflicts: WiddxIssue[] = [];
        const errors: WiddxIssue[] = []; // Used for PROTOCOL_VIOLATION
        const exportMap = new Map<string, string[]>(); // Symbol -> FilePaths[]

        const activeProtocols = activeProtocolIds.map(id => ProtocolEngine.getProtocol(id));

        // 0. Global Protocol Checks (e.g. required files)
        activeProtocols.forEach(p => {
            if (p.validationRules?.requiredFiles) {
                p.validationRules.requiredFiles.forEach(reqFile => {
                    // Check if file exists in nodes
                    const found = nodes.some(n => n.id.endsWith(reqFile) || n.name === reqFile);
                    if (!found) {
                        errors.push({
                            id: `proto-missing-${p.id}-${reqFile}`,
                            severity: 'CRITICAL',
                            type: 'PROTOCOL_VIOLATION',
                            message: `[${p.name}] Missing required file: '${reqFile}'.`
                        });
                    }
                });
            }
        });

        nodes.forEach(node => {
            // A. Orphan Detection
            if (node.status === WiddxFlowStatus.ORPHAN && node.type === WiddxNodeType.FILE) {
                // Ignore config files and hidden files usually
                if (!node.name.includes('config') && !node.name.startsWith('.') && !node.name.endsWith('.md')) {
                   warnings.push({
                     id: `warn-orphan-${node.id}`,
                     severity: 'WARNING',
                     type: 'ORPHAN',
                     message: `Unused File: ${node.name}`,
                     nodeId: node.id
                   });
                }
            }

            // B. Content Analysis
            if (node.type === WiddxNodeType.FILE && node.content !== undefined) {
                
                const content = node.content;

                // 1. Empty File Check
                if (content.trim().length === 0) {
                     warnings.push({
                         id: `warn-empty-${node.id}`,
                         severity: 'WARNING',
                         type: 'ORPHAN',
                         message: `Empty File: '${node.name}' has no content.`,
                         nodeId: node.id
                     });
                }

                // 2. TODO/FIXME Scanner
                const todoMatch = content.match(/\/\/\s*(TODO|FIXME):(.*)/);
                if (todoMatch) {
                    conflicts.push({
                        id: `task-${node.id}-${Math.random()}`,
                        severity: 'WARNING',
                        type: 'TODO',
                        message: `${todoMatch[1]}: ${todoMatch[2].trim().substring(0, 60)}${todoMatch[2].length > 60 ? '...' : ''}`,
                        nodeId: node.id
                    });
                }

                // 3. Complexity Warning (Structural Risk)
                if (node.size > 800) { 
                  conflicts.push({
                    id: `complexity-${node.id}`,
                    severity: 'WARNING',
                    type: 'REDUNDANCY',
                    message: `Complexity Conflict: File is excessively large (${node.size} lines). Recommend refactoring.`,
                    nodeId: node.id
                  });
                }

                // 4. Export Gathering
                const exports = this.extractExportNames(content);
                exports.forEach(exp => {
                    if (!exportMap.has(exp)) exportMap.set(exp, []);
                    exportMap.get(exp)?.push(node.id);
                });

                // 5. Active Protocol Violations (Node Level)
                activeProtocols.forEach(p => {
                    const rules = p.validationRules;
                    if (!rules) return;

                    // Forbidden Imports
                    if (rules.forbiddenImports) {
                        rules.forbiddenImports.forEach(imp => {
                            const regex = new RegExp(`(?:import|require).*['"]${imp}['"]`);
                            if (regex.test(content)) {
                                errors.push({
                                    id: `proto-forbid-${node.id}-${imp}`,
                                    severity: 'CRITICAL',
                                    type: 'PROTOCOL_VIOLATION',
                                    message: `[${p.name}] Forbidden import detected: '${imp}'.`,
                                    nodeId: node.id
                                });
                            }
                        });
                    }

                    // Forbidden Patterns
                    if (rules.forbiddenPatterns) {
                        rules.forbiddenPatterns.forEach(rule => {
                            const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
                            if (pattern.test(content)) {
                                errors.push({
                                    id: `proto-pattern-${node.id}-${Math.random()}`,
                                    severity: 'CRITICAL',
                                    type: 'PROTOCOL_VIOLATION',
                                    message: `[${p.name}] ${rule.message}`,
                                    nodeId: node.id
                                });
                            }
                        });
                    }
                });
            }
        });

        // C. Naming Collision Detection
        exportMap.forEach((paths, symbol) => {
            if (paths.length > 1) {
                conflicts.push({
                    id: `conflict-name-${symbol}`,
                    severity: 'WARNING',
                    type: 'NAMING_COLLISION',
                    message: `Naming Collision: Symbol '${symbol}' is exported by multiple files: ${paths.join(', ')}`,
                    nodeId: paths[0]
                });
            }
        });

        return { warnings, conflicts, errors };
    }

    private static extractExportNames(content: string): string[] {
        const names: string[] = [];
        const patterns = [
            /export\s+(?:const|let|var|function|class|type|interface|enum)\s+([\w$]+)/g,
            /export\s+{\s*([\w\s,]+)\s*}/g,
            /export\s+default\s+(?:function|class)?\s*([\w$]+)?/g
        ];
        
        patterns.forEach((regex, i) => {
            let match;
            const r = new RegExp(regex);
            while ((match = r.exec(content)) !== null) {
                if (i === 1 && match[1]) { // List exports { a, b }
                    match[1].split(',').forEach(s => names.push(s.trim()));
                } else if (match[1]) {
                    names.push(match[1]);
                }
            }
        });
        return names;
    }
}