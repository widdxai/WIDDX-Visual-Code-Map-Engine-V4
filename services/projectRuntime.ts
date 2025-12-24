import { WiddxGraph, WiddxFileEntry, WiddxProtocolType } from '../types';
import { StorageService } from './storageService';
import { WiddxEngine } from './widdxEngine';
import { GraphPatcher } from './engine/graphPatcher';
import { GraphReducer } from './engine/graphReducer';

export class ProjectRuntime {
    private static instance: ProjectRuntime;
    
    private _graph: WiddxGraph | null = null;
    private _files: WiddxFileEntry[] = [];
    private _projectId: string = 'default'; // Unique identifier for storage scoping
    private listeners: Set<() => void> = new Set();
    
    // Truth Drift Mitigation
    private mutationCount = 0;
    private isReconciling = false;
    
    private constructor() {}

    public static get(): ProjectRuntime {
        if (!this.instance) this.instance = new ProjectRuntime();
        return this.instance;
    }

    public get graph() { return this._graph; }
    public get files() { return this._files; }
    public get projectId() { return this._projectId; }

    public subscribe(cb: () => void) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private emit() {
        this.listeners.forEach(cb => cb());
    }

    private generateProjectId(graph: WiddxGraph): string {
        const manifest = graph.widdxMeta.manifest;
        // Generate a deterministic ID based on project name and entry point
        // This ensures if the user re-uploads the same project folder, we recover the state
        const rawId = `${manifest.name}-${graph.widdxMeta.entry}`;
        try {
            return btoa(encodeURIComponent(rawId)).replace(/=/g, '');
        } catch {
            return 'project_' + Date.now();
        }
    }

    public async load() {
        this._files = await StorageService.loadFiles();
        if (this._files.length > 0) {
            this._graph = await WiddxEngine.analyzeProject(this._files);
            this._projectId = this.generateProjectId(this._graph);
            this.mutationCount = 0;
            this.validateIntegrity();
            this.emit();
        }
    }

    public async ingest(files: WiddxFileEntry[]) {
        this._files = files;
        await StorageService.saveFiles(files);
        this._graph = await WiddxEngine.analyzeProject(files);
        this._projectId = this.generateProjectId(this._graph);
        this.mutationCount = 0;
        this.validateIntegrity();
        this.emit();
    }

    public async reset() {
        this._files = [];
        this._graph = null;
        this._projectId = 'default';
        this.mutationCount = 0;
        await StorageService.clearFiles();
        this.emit();
    }

    public applyMutation(action: 'UPDATE' | 'CREATE' | 'DELETE', path: string, content: string = '') {
        if (!this._graph) return;
        
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const entry: WiddxFileEntry = { path: cleanPath, content };

        // 1. Apply Incremental Patch
        const diff = GraphPatcher.createDiff(this._graph, { action, file: entry });
        this._graph = GraphReducer.apply(this._graph, diff);
        this._files = this._graph.virtualFileSystem;
        
        // 2. Persist
        StorageService.saveFiles(this._files);
        this.validateIntegrity();
        this.emit();

        // 3. Drift Mitigation: Trigger Reconciliation if needed
        this.mutationCount++;
        if (this.mutationCount > 50) {
            this.reconcileGraph();
        }
    }

    public updateProtocols(protocols: WiddxProtocolType[]) {
        if (this._graph) {
             this._graph.widdxMeta.protocols = protocols;
             this.emit();
        }
    }

    private validateIntegrity() {
        if (!this._graph) return;
        const fileCount = this._files.length;
        const nodeCount = this._graph.nodes.filter(n => n.type === 'FILE').length;
        if (fileCount !== nodeCount) {
            console.warn(`Graph Integrity Drift: VFS has ${fileCount} files, Graph has ${nodeCount} nodes.`);
        }
    }

    /**
     * Performs a full O(N) re-analysis of the project to correct any 
     * structural drift (accumulated incremental inaccuracies).
     * Runs in the background to avoid blocking UI.
     */
    private async reconcileGraph() {
        if (this.isReconciling || !this._files.length) return;
        
        this.isReconciling = true;
        console.log(`[ProjectRuntime] Triggering Graph Reconciliation (Mutations: ${this.mutationCount})...`);
        
        try {
            // Snapshot current VFS state for analysis
            const currentProtocols = this._graph?.widdxMeta.protocols;
            const freshGraph = await WiddxEngine.analyzeProject(this._files, currentProtocols);
            
            // Re-link to latest VFS (The Runtime _files is SSOT for content)
            // This ensures that if the user typed during analysis, we don't revert content,
            // even if the graph structure is split-second stale regarding that specific keystroke.
            freshGraph.virtualFileSystem = this._files;
            
            // Update Versioning
            freshGraph.version = (this._graph?.version || 0) + 1;
            freshGraph.lastFullAnalysis = Date.now();

            // Swap Graph
            this._graph = freshGraph;
            // Preserve ID through reconcile
            // this._projectId = this.generateProjectId(this._graph); // Keep existing ID
            this.mutationCount = 0;
            
            this.validateIntegrity();
            this.emit();
            console.log(`[ProjectRuntime] Reconciliation Complete.`);
        } catch (e) {
            console.error("[ProjectRuntime] Reconciliation Failed", e);
        } finally {
            this.isReconciling = false;
        }
    }
}