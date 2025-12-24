
import { WiddxGraph, WiddxNodeType } from '../types';

export class MermaidGenerator {
  private static idMap = new Map<string, string>();
  private static counter = 0;

  public static getSafeId(id: string): string {
    if (!this.idMap.has(id)) {
        this.counter++;
        // Use simpler IDs to prevent Mermaid syntax errors
        this.idMap.set(id, `N${this.counter}`);
    }
    return this.idMap.get(id)!;
  }

  public static generate(graph: WiddxGraph): string {
    this.idMap.clear();
    this.counter = 0;

    let mermaid = 'flowchart TD\n';
    
    // Define Styles
    const styles = [
      'classDef base fill:#0f172a,stroke:#334155,color:#e2e8f0,stroke-width:1px',
      'classDef process fill:#1e293b,stroke:#475569,color:#f8fafc,stroke-width:1px',
      'classDef decision fill:#0f172a,stroke:#3b82f6,color:#bfdbfe,stroke-width:2px',
      'classDef missing fill:#450a0a,stroke:#ef4444,color:#fca5a5,stroke-dasharray:5 5',
      'classDef folder fill:none,stroke:#334155,color:#64748b,stroke-dasharray:4 4',
      'classDef config fill:#1e1e1e,stroke:#f59e0b,color:#fbbf24,stroke-width:2px,stroke-dasharray:3 2'
    ];
    mermaid += styles.join('\n') + '\n';

    // Helper to escape labels
    const sanitizeLabel = (name: string) => {
        return name.replace(/["'<>\[\](){}]/g, '').trim(); 
    };

    const files = graph.nodes.filter(n => n.type !== WiddxNodeType.FOLDER);
    const folders = graph.nodes.filter(n => n.type === WiddxNodeType.FOLDER);
    const processed = new Set<string>();

    // 1. Render Folders (Subgraphs)
    const renderFolder = (folderId: string): string => {
        const folder = graph.nodes.find(n => n.id === folderId);
        if (!folder) return '';
        
        const children = files.filter(f => f.parentId === folderId);
        const subFolders = folders.filter(f => f.parentId === folderId);
        
        if (children.length === 0 && subFolders.length === 0) return '';
        
        const safeId = this.getSafeId(folderId);
        let output = `\nsubgraph ${safeId} ["📂 ${sanitizeLabel(folder.name)}"]\n direction TB\n`;
        
        children.forEach(file => {
             const fid = this.getSafeId(file.id);
             const { shape, style } = getNodeStyle(file);
             output += `  ${fid}${shape}"${sanitizeLabel(file.name)}"${getCloseShape(shape)}:::${style}\n`;
             processed.add(file.id);
        });

        subFolders.forEach(sf => {
            output += renderFolder(sf.id);
        });

        output += `end\n`;
        return output;
    };

    folders.filter(f => !f.parentId || f.parentId === '/').forEach(f => {
        mermaid += renderFolder(f.id);
    });

    files.filter(f => !f.parentId || f.parentId === '/').forEach(f => {
        if (!processed.has(f.id)) {
             const fid = this.getSafeId(f.id);
             const { shape, style } = getNodeStyle(f);
             mermaid += `${fid}${shape}"${sanitizeLabel(f.name)}"${getCloseShape(shape)}:::${style}\n`;
             processed.add(f.id);
        }
    });

    graph.nodes.filter(n => n.type === WiddxNodeType.MISSING).forEach(n => {
        if (!processed.has(n.id)) {
            const fid = this.getSafeId(n.id);
            mermaid += `${fid}["⚠️ ${sanitizeLabel(n.name)}"]:::missing\n`;
        }
    });

    // 2. Render Edges & Apply Electric Styles
    let linkCounter = 0;
    let validLinksIndices: number[] = [];
    let brokenLinksIndices: number[] = [];

    graph.edges.forEach(e => {
        const src = this.getSafeId(e.source);
        const tgt = this.getSafeId(e.target);
        if (src && tgt && src !== tgt) {
            const targetNode = graph.nodes.find(n => n.id === e.target);
            const isBroken = targetNode?.type === WiddxNodeType.MISSING;
            const arrow = '-->'; // Always use solid arrow base, we style via linkStyle
            
            mermaid += `${src} ${arrow} ${tgt}\n`;
            
            if (isBroken) {
                brokenLinksIndices.push(linkCounter);
            } else {
                validLinksIndices.push(linkCounter);
            }
            linkCounter++;
        }
    });

    // Apply Electric Styles via linkStyle
    // Valid Flows: Blue (#3b82f6) - Matches CSS animation selector
    if (validLinksIndices.length > 0) {
        mermaid += `linkStyle ${validLinksIndices.join(',')} stroke:#3b82f6,stroke-width:2px,fill:none;\n`;
    }

    // Broken Flows: Red (#ef4444) - Matches CSS warning pulse selector
    if (brokenLinksIndices.length > 0) {
        mermaid += `linkStyle ${brokenLinksIndices.join(',')} stroke:#ef4444,stroke-width:2px,stroke-dasharray: 5 5,fill:none;\n`;
    }

    return mermaid;
  }
}

function getCloseShape(open: string) {
    if (open === '{') return '}';
    if (open === '{{') return '}}';
    if (open === '([') return '])';
    if (open === '[(') return ')]';
    if (open === '[[') return ']]';
    return ']';
}

function getNodeStyle(node: any) {
    const name = node.name.toLowerCase();
    
    // Chrome Extension & Configs
    if (name === 'manifest.json' || name === 'package.json') {
         return { shape: '[[', style: 'config' };
    }

    if (name.includes('util') || name.includes('helper') || name.includes('service') || name.includes('controller') || name.includes('hook')) {
        return { shape: '{', style: 'decision' };
    }
    if (name.endsWith('.tsx') || name.endsWith('.jsx') || name.endsWith('.vue')) {
        return { shape: '([', style: 'process' };
    }
    if (name.endsWith('.json') || name.includes('config') || name.includes('schema')) {
        return { shape: '[(', style: 'process' };
    }
    return { shape: '[', style: 'process' };
}