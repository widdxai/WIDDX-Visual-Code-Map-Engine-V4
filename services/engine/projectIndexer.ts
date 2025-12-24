
import { WiddxNode, WiddxNodeType, WiddxIndex, WiddxSymbol } from '../../types';

export class ProjectIndexer {

    public static buildIndex(nodes: WiddxNode[]): WiddxIndex {
        const symbolMap = new Map<string, WiddxSymbol[]>();
        const fileExports = new Map<string, string[]>();

        nodes.forEach(node => {
            if (node.type === WiddxNodeType.FILE && node.content) {
                const symbols = this.extractSymbols(node.content, node.id);
                
                if (symbols.length > 0) {
                    fileExports.set(node.id, symbols.map(s => s.name));
                    
                    symbols.forEach(sym => {
                        if (!symbolMap.has(sym.name)) {
                            symbolMap.set(sym.name, []);
                        }
                        symbolMap.get(sym.name)!.push(sym);
                    });
                }
            }
        });

        return {
            symbols: symbolMap,
            files: fileExports
        };
    }

    /**
     * Incrementally updates the index for a single node modification.
     * This ensures AI agents have up-to-date symbol knowledge immediately after edits.
     */
    public static patchIndex(currentIndex: WiddxIndex, node: WiddxNode): WiddxIndex {
        // 1. Remove old symbols associated with this file
        const oldSymbols = currentIndex.files.get(node.id) || [];
        
        // Clone maps to ensure immutability state updates in React
        const newSymbolMap = new Map(currentIndex.symbols);
        const newFilesMap = new Map(currentIndex.files);
        
        // Clean up old references
        oldSymbols.forEach(symName => {
            const occurrences = newSymbolMap.get(symName);
            if (occurrences) {
                const filtered = occurrences.filter(s => s.fileId !== node.id);
                if (filtered.length === 0) {
                    newSymbolMap.delete(symName);
                } else {
                    newSymbolMap.set(symName, filtered);
                }
            }
        });

        // 2. Parse and add new symbols if content exists
        if (node.type === WiddxNodeType.FILE && node.content) {
            const newSymbols = this.extractSymbols(node.content, node.id);
            if (newSymbols.length > 0) {
                newFilesMap.set(node.id, newSymbols.map(s => s.name));
                
                newSymbols.forEach(sym => {
                    if (!newSymbolMap.has(sym.name)) {
                        newSymbolMap.set(sym.name, []);
                    }
                    newSymbolMap.get(sym.name)!.push(sym);
                });
            } else {
                newFilesMap.delete(node.id);
            }
        } else {
            // File deleted or invalid
            newFilesMap.delete(node.id);
        }

        return {
            symbols: newSymbolMap,
            files: newFilesMap
        };
    }

    private static extractSymbols(content: string, filePath: string): WiddxSymbol[] {
        const symbols: WiddxSymbol[] = [];
        const lines = content.split('\n');
        
        // Regex patterns for different languages/constructs
        const patterns = [
            // TypeScript/JS Functions: export function name(...)
            { regex: /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/, kind: 'function' },
            // Classes: export class Name
            { regex: /export\s+(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/, kind: 'class' },
            // Variables/Arrow Functions: export const name = ...
            { regex: /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*[:=]/, kind: 'variable' },
            // Interfaces/Types
            { regex: /export\s+(?:interface|type)\s+([a-zA-Z0-9_$]+)/, kind: 'interface' },
            // React Components (Heuristic: PascalCase const)
            { regex: /export\s+const\s+([A-Z][a-zA-Z0-9_$]+)\s*:/, kind: 'component' }
        ];

        lines.forEach((line, idx) => {
            for (const p of patterns) {
                const match = line.match(p.regex);
                if (match) {
                    // Extract simplistic signature (just the line content trimmed)
                    const signature = line.trim().substring(0, 100);
                    
                    symbols.push({
                        name: match[1],
                        kind: p.kind as any,
                        fileId: filePath,
                        line: idx + 1,
                        signature
                    });
                    break; // Only match one type per line
                }
            }
        });

        return symbols;
    }
}
