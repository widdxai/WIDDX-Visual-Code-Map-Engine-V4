import { useState, useEffect, useCallback } from 'react';
import { ProjectRuntime } from '../services/projectRuntime';
import { WiddxFileEntry, WiddxGraph, WiddxNode } from '../types';
import { StorageService } from '../services/storageService';
import { WiddxAiService } from '../services/widdxAiService';
import { ProjectExportService } from '../services/projectExportService';
import { WiddxProtocolType } from '../services/widdxProtocols';

export const useProjectManager = () => {
    const runtime = ProjectRuntime.get();
    
    // Local state for UI only (Selection/Open Files)
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    
    // Sync with Runtime
    const [graph, setGraph] = useState<WiddxGraph | null>(runtime.graph);
    const [files, setFiles] = useState<WiddxFileEntry[]>(runtime.files);
    const [projectId, setProjectId] = useState<string>(runtime.projectId);

    useEffect(() => {
        const unsub = runtime.subscribe(() => {
            setGraph(runtime.graph);
            setFiles(runtime.files);
            setProjectId(runtime.projectId);
        });
        return unsub;
    }, []);

    useEffect(() => {
        runtime.load();
    }, []);

    // --- Session UI State (Scoped by Project) ---
    // When project ID changes (e.g. load different project), reload the context
    useEffect(() => {
        if (projectId && projectId !== 'default') {
            StorageService.loadUiState(projectId, 'session_context').then(state => {
                if (state) {
                    if (state.openFiles) setOpenFiles(state.openFiles);
                    if (state.selectedNodeId) setSelectedNodeId(state.selectedNodeId);
                } else {
                    // Reset if no saved state for this project
                    setOpenFiles([]);
                    setSelectedNodeId(null);
                }
            });
        }
    }, [projectId]);

    // Save state on change
    useEffect(() => {
        if (graph && projectId && projectId !== 'default') {
            StorageService.saveUiState(projectId, 'session_context', { openFiles, selectedNodeId });
        }
    }, [openFiles, selectedNodeId, graph, projectId]);


    // --- Actions delegated to Runtime ---
    const handleIngest = useCallback((newFiles: WiddxFileEntry[]) => {
        runtime.ingest(newFiles);
        // Note: Runtime will emit, causing projectId to update, causing useEffect to load fresh (empty) state
    }, []);

    const handleResetProject = useCallback(async () => {
        const currentPid = runtime.projectId;
        await runtime.reset();
        // Clear state for the project we just closed/reset
        if (currentPid && currentPid !== 'default') {
            await StorageService.saveUiState(currentPid, 'session_context', null);
        }
        setSelectedNodeId(null);
        setOpenFiles([]);
    }, []);

    const handleUpdateFile = useCallback((path: string, content: string) => {
        runtime.applyMutation('UPDATE', path, content);
    }, []);

    const handleDeleteFile = useCallback((path: string) => {
        runtime.applyMutation('DELETE', path);
        setOpenFiles(prev => prev.filter(p => !p.includes(path)));
        if (selectedNodeId?.includes(path)) setSelectedNodeId(null);
    }, [selectedNodeId]);

    const handleCreateFile = useCallback((path: string) => {
        runtime.applyMutation('CREATE', path, '// New File');
        const id = path.startsWith('/') ? path : '/' + path;
        setSelectedNodeId(id);
        setOpenFiles(prev => [...prev, id]);
    }, []);

    const handleRenameFile = useCallback((oldPath: string, newPath: string) => {
        const file = files.find(f => f.path === oldPath || '/' + f.path === oldPath);
        if (file) {
            runtime.applyMutation('DELETE', oldPath);
            runtime.applyMutation('CREATE', newPath, file.content);
        }
    }, [files]);

    const updateProtocols = useCallback((protocols: WiddxProtocolType[]) => {
        runtime.updateProtocols(protocols);
    }, []);

    // --- AI Hooks ---
    const [isFixing, setIsFixing] = useState(false);
    const [aiProcessingNodeId, setAiProcessingNodeId] = useState<string | null>(null);

    const handleFixFile = useCallback(async (path: string, importerId: string | null, userHint?: string) => {
        if (!graph) return;
        setIsFixing(true);
        setAiProcessingNodeId(path);
        
        try {
            const context = {
                nodeId: path,
                graphSnapshot: graph,
                mutationIntent: 'FIX_BROKEN_IMPORT'
            };

            const content = await WiddxAiService.generateSmartFixV2(context, importerId, userHint);
            
            runtime.applyMutation('CREATE', path, content);
            
            const id = path.startsWith('/') ? path : '/' + path;
            setSelectedNodeId(id);
            if (!openFiles.includes(id)) setOpenFiles(prev => [...prev, id]);

        } catch (e) {
            console.error(e);
        } finally {
            setIsFixing(false);
            setAiProcessingNodeId(null);
        }
    }, [graph, openFiles]);

    const handleFixAll = useCallback(async (missingNodes: WiddxNode[]) => {
         // Batch fix logic to be implemented via runtime
    }, []);

    const handleNodeSelect = useCallback((id: string) => {
        setSelectedNodeId(id);
        const node = graph?.nodes.find(n => n.id === id);
        if (node?.type === 'FILE') {
             setOpenFiles(prev => prev.includes(id) ? prev : [...prev, id]);
        }
    }, [graph]);

    const handleCloseFile = useCallback((id: string) => {
        setOpenFiles(prev => prev.filter(f => f !== id));
    }, []);
    
    const handleExportZip = useCallback(() => {
        ProjectExportService.exportToZip(runtime.files);
    }, [runtime.files]);

    return {
        files, graph, selectedNodeId, openFiles, aiProcessingNodeId, isFixing,
        isRestoring: false, 
        projectId, // Expose projectId
        setAiProcessingNodeId,
        handleIngest, handleResetProject, handleUpdateFile, handleDeleteFile, handleCreateFile, handleRenameFile,
        handleExportZip, handleFixFile, handleFixAll, handleNodeSelect, handleCloseFile, updateProtocols,
        protocolOverrides: graph?.widdxMeta.protocols || [],
        analyze: (files: WiddxFileEntry[]) => { runtime.ingest(files); }, 
        setFiles: () => {}, setGraph: () => {} 
    };
};