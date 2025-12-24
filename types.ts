
export enum WiddxNodeType {
  FILE = 'FILE',
  FOLDER = 'FOLDER', 
  MISSING = 'MISSING', 
  UNKNOWN = 'UNKNOWN'
}

export enum WiddxFlowStatus {
  VALID = 'VALID',     
  BROKEN = 'BROKEN',   
  ORPHAN = 'ORPHAN',   
  EXTERNAL = 'EXTERNAL',
  CONFLICT = 'CONFLICT'
}

export type WiddxProtocolType = 'CHROME_EXT_V3' | 'LARAVEL_MVC' | 'REACT_MODERN' | 'UNIVERSAL';

export interface WiddxProjectManifest {
  name: string;
  technologyStack: string[];
  externalDependencies: Record<string, string>;
  detectedArchitecture: 'MVC' | 'FLUX' | 'ATOMIC' | 'MODULAR' | 'UNKNOWN';
  entryPoint: string;
  totalLinesOfCode: number;
  complexityScore: number;
}

export interface WiddxMeta {
  product: string;
  language: string;
  framework: string;
  protocols: WiddxProtocolType[]; // Changed to array for hybrid support
  entry: string;
  defaultOpenFolders: string[];
  manifest: WiddxProjectManifest;
}

export interface WiddxNode {
  id: string; 
  name: string; 
  type: WiddxNodeType;
  size: number; 
  status: WiddxFlowStatus;
  content?: string; 
  parentId?: string | null; 
}

export interface WiddxEdge {
  source: string; 
  target: string; 
  type: 'IMPORT' | 'EXPORT' | 'DYNAMIC';
}

export interface WiddxFlow {
  id: string;
  path: string[]; 
  isValid: boolean;
}

export interface WiddxIssue {
  id: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  nodeId?: string;
  type?: 'BROKEN_IMPORT' | 'CIRCULAR' | 'NAMING_COLLISION' | 'ORPHAN' | 'REDUNDANCY' | 'TODO' | 'PROTOCOL_VIOLATION';
}

export interface WiddxFileEntry {
  path: string;
  content: string;
}

// --- NEW SEMANTIC INDEXING TYPES ---
export interface WiddxSymbol {
    name: string;
    kind: 'function' | 'class' | 'variable' | 'interface' | 'component';
    fileId: string;
    line: number;
    signature?: string; // e.g. "login(user: User): Promise<void>"
}

export interface WiddxIndex {
    symbols: Map<string, WiddxSymbol[]>; // Map<SymbolName, Occurrences>
    files: Map<string, string[]>; // Map<FileId, ExportedSymbols[]>
}

export interface WiddxGraph {
  widdxMeta: WiddxMeta;
  nodes: WiddxNode[];
  edges: WiddxEdge[];
  flows: WiddxFlow[];
  warnings: WiddxIssue[];
  errors: WiddxIssue[];
  conflicts: WiddxIssue[];
  virtualFileSystem: WiddxFileEntry[]; 
  index: WiddxIndex; // Added the Index
  version?: number;          // Graph Version for Drift Detection
  lastFullAnalysis?: number; // Timestamp of last full O(N) scan
}

// --- MCP Types ---
export interface McpServerConfig {
    id: string;
    name: string;
    url: string;
    status: 'connected' | 'disconnected' | 'error';
    enabled: boolean;
}

export interface McpTool {
    name: string;
    description?: string;
    inputSchema: any;
}