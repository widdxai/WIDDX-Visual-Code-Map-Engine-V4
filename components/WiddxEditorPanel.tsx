
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    FileCode2, Save, Trash2, LayoutTemplate, Loader2, Check, 
    Code, Sparkles, Send, Maximize2, Minimize2, Network, 
    AlignJustify, MousePointerClick, BookOpen, X, FileJson, Code2, FileType, Database, Settings, Image, Plus,
    ChevronRight, Home, MoreHorizontal, Copy, Scissors, AlertCircle
} from 'lucide-react';
import Editor, { useMonaco, OnMount } from '@monaco-editor/react';
import { widdxGetLanguageFromPath } from '../services/widdxAnalysisUtils';
import { Language, translations } from '../services/i18n';
import { WiddxAiService } from '../services/widdxAiService';
import { WiddxDiffReviewModal } from './WiddxDiffReviewModal';
import { WiddxFileEntry } from '../types';
import { EditorConfig, DEFAULT_EDITOR_CONFIG } from '../services/storageService';

interface WiddxEditorPanelProps {
    selectedNodeId: string | null;
    openFiles: string[]; 
    onCloseFile: (id: string) => void;
    onSelectFile: (id: string) => void;
    initialContent: string | undefined;
    fileName: string | undefined;
    files?: WiddxFileEntry[]; 
    onUpdateFile: (path: string, content: string) => void;
    onDeleteFile: (path: string) => void;
    onRevealInGraph?: () => void;
    lang: Language;
    editorSettings?: EditorConfig; 
    revealLine?: number;
}

const REACT_TYPES = `
declare module 'react' { export const useState: any; export const useEffect: any; export const useCallback: any; export const useMemo: any; export const useRef: any; export const createContext: any; export const useContext: any; }
declare module 'react-dom/client' { export const createRoot: any; }
declare module 'lucide-react' { export const Camera: any; export const Video: any; [key: string]: any; }
`;

export const WiddxEditorPanel: React.FC<WiddxEditorPanelProps> = ({
    selectedNodeId, openFiles, onCloseFile, onSelectFile, initialContent, fileName, files,
    onUpdateFile, onDeleteFile, onRevealInGraph, lang, editorSettings = DEFAULT_EDITOR_CONFIG, revealLine
}) => {
    const [editorContent, setEditorContent] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [isZenMode, setIsZenMode] = useState(false);
    
    const [showAiInput, setShowAiInput] = useState(false);
    const [aiInstruction, setAiInstruction] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [pendingAiContent, setPendingAiContent] = useState<string | null>(null);

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorRef = useRef<any>(null); 
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const monaco = useMonaco();
    const t = translations[lang];

    const activeUri = useMemo(() => {
        if (!selectedNodeId) return undefined;
        // Normalizing path for Monaco URI (must start with /)
        const path = selectedNodeId.startsWith('/') ? selectedNodeId : '/' + selectedNodeId;
        return `file://${path}`;
    }, [selectedNodeId]);

    const getFileIcon = (path: string) => {
        const lower = path.toLowerCase();
        if (lower.endsWith('.tsx') || lower.endsWith('.ts')) return <FileCode2 size={13} className="text-blue-400" />;
        if (lower.endsWith('.jsx') || lower.endsWith('.js')) return <Code2 size={13} className="text-yellow-400" />;
        if (lower.endsWith('.json')) return <FileJson size={13} className="text-yellow-500" />;
        if (lower.endsWith('.css') || lower.endsWith('.scss')) return <FileType size={13} className="text-sky-300" />;
        return <Code size={13} className="text-zinc-500" />;
    };

    const getFileName = (path: string) => path.split('/').pop() || path;

    // --- MONACO CONFIGURATION & THEME ---
    useEffect(() => {
        if (monaco) {
            monaco.editor.defineTheme('widdx-charcoal', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
                    { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
                    { token: 'string', foreground: '4ade80' },
                    { token: 'function', foreground: '8b5cf6' }, // Purple functions
                    { token: 'type', foreground: 'f59e0b' },
                    { token: 'class', foreground: 'f59e0b' },
                ],
                colors: {
                    'editor.background': '#121212', // Charcoal
                    'editor.foreground': '#f4f4f5',
                    'editor.lineHighlightBackground': '#18181b',
                    'editorLineNumber.foreground': '#52525b',
                    'editorIndentGuide.background': '#27272a',
                    'editorIndentGuide.activeBackground': '#8b5cf6', // Purple active guide
                    'editor.selectionBackground': '#8b5cf633', // Purple selection
                    'editor.inactiveSelectionBackground': '#8b5cf611',
                }
            });
            monaco.editor.setTheme('widdx-charcoal');

            // Configure TS Compiler Options for better Intellisense
            const ts = (monaco.languages.typescript as any);
            ts.typescriptDefaults.setCompilerOptions({ 
                target: ts.ScriptTarget.ES2020, 
                allowNonTsExtensions: true, 
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                module: ts.ModuleKind.CommonJS,
                noEmit: true,
                typeRoots: ["node_modules/@types"],
                jsx: ts.JsxEmit.React 
            });
            
            ts.typescriptDefaults.addExtraLib(REACT_TYPES, 'file:///node_modules/@types/react/index.d.ts');
        }
    }, [monaco]);

    // --- PROJECT-WIDE INTELLISENSE (SYNC MODELS) ---
    // This effect ensures that ALL files in the project exist as Monaco Models.
    // This allows Monaco to resolve imports like `import { x } from './utils'` even if `utils.ts` isn't open.
    useEffect(() => {
        if (!monaco || !files) return;

        files.forEach(file => {
            const path = file.path.startsWith('/') ? file.path : '/' + file.path;
            const uri = monaco.Uri.parse(`file://${path}`);
            let model = monaco.editor.getModel(uri);

            if (!model) {
                // Create model if it doesn't exist
                monaco.editor.createModel(
                    file.content, 
                    widdxGetLanguageFromPath(path), 
                    uri
                );
            } else if (model.getValue() !== file.content && !model.isDisposed()) {
                // Update content if changed externally (and not currently being edited by user to avoid cursor jumps)
                // Note: We avoid updating the *currently open* model here to prevent fighting with local state,
                // but for background files, we keep them fresh for Intellisense.
                if (activeUri !== uri.toString()) {
                    model.setValue(file.content);
                }
            }
        });
    }, [monaco, files, activeUri]);

    // Update local content when selection changes
    useEffect(() => {
        if (selectedNodeId && initialContent !== undefined) {
            setEditorContent(initialContent);
            setIsDirty(false);
            setSaveStatus('saved');
            setShowAiInput(false);
            setAiInstruction('');
            setPendingAiContent(null);
        }
    }, [selectedNodeId, initialContent]);

    // Handle Reveal Line (Jump to definition)
    useEffect(() => {
        if (editorRef.current && revealLine && revealLine > 0) {
            setTimeout(() => {
                editorRef.current.revealLineInCenter(revealLine);
                editorRef.current.setPosition({ lineNumber: revealLine, column: 1 });
                editorRef.current.focus();
                // Highlight line momentarily
                const decorations = editorRef.current.deltaDecorations([], [
                    { range: new monaco.Range(revealLine, 1, revealLine, 1), options: { isWholeLine: true, className: 'bg-purple-500/20' } }
                ]);
                setTimeout(() => editorRef.current.deltaDecorations(decorations, []), 1000);
            }, 100);
        }
    }, [revealLine, selectedNodeId]);

    // Auto-Save Logic
    useEffect(() => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        if (isDirty && selectedNodeId) {
            setSaveStatus('unsaved');
            autoSaveTimerRef.current = setTimeout(() => {
                setSaveStatus('saving');
                onUpdateFile(selectedNodeId, editorContent);
                setTimeout(() => { setIsDirty(false); setSaveStatus('saved'); }, 600);
            }, 2000); 
        }
    }, [editorContent, isDirty, selectedNodeId]);

    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        
        // Add Keybinding: Ctrl+S to Save
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            handleManualSave();
        });

        // Add Keybinding: Alt+Shift+F to Format
        editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
            editor.getAction('editor.action.formatDocument')?.run();
        });
        
        // Immediate reveal if prop exists on mount
        if (revealLine) {
            editor.revealLineInCenter(revealLine);
            editor.setPosition({ lineNumber: revealLine, column: 1 });
        }
    };

    const handleManualSave = () => {
        if (selectedNodeId) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            setSaveStatus('saving');
            onUpdateFile(selectedNodeId, editorContent);
            setTimeout(() => { setIsDirty(false); setSaveStatus('saved'); }, 200);
        }
    };

    const handleAiSubmit = async () => {
        if (!selectedNodeId || !aiInstruction.trim()) return;
        setIsAiProcessing(true);
        try {
            const newCode = await WiddxAiService.generateRefactor(editorContent, aiInstruction, fileName || 'file');
            setPendingAiContent(newCode);
            setShowAiInput(false);
        } catch (e) {
            alert("AI Refactor Failed.");
        } finally {
            setIsAiProcessing(false);
        }
    };

    // --- BREADCRUMB BUILDER ---
    const breadcrumbs = useMemo(() => {
        if (!selectedNodeId) return [];
        const parts = selectedNodeId.split('/').filter(Boolean);
        return parts;
    }, [selectedNodeId]);

    if (!selectedNodeId && openFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4 bg-[#121212] widdx-engineering-bg">
                <div className="w-20 h-20 rounded-2xl bg-[#18181b] border border-zinc-800 flex items-center justify-center shadow-2xl">
                    <Code size={36} className="text-zinc-500 opacity-50" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-zinc-400">{t.no_file_selected}</p>
                    <p className="text-[11px] max-w-[220px] text-zinc-600 mt-2">{t.select_file_hint}</p>
                </div>
                {/* Quick Actions for Empty State */}
                <div className="flex gap-2 mt-4">
                    <button className="text-xs bg-[#18181b] hover:bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded text-zinc-300 flex items-center gap-2 transition-colors">
                        <FileCode2 size={12} /> New File
                    </button>
                    <button className="text-xs bg-[#18181b] hover:bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded text-zinc-300 flex items-center gap-2 transition-colors">
                        <Settings size={12} /> Config
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`h-full flex flex-col bg-[#121212] relative ${isZenMode ? 'fixed inset-0 z-[100]' : ''}`}>
            
            {/* --- TOP BAR: TABS & BREADCRUMBS --- */}
            {!isZenMode && (
                <div className="flex flex-col border-b border-zinc-800 bg-[#18181b] shrink-0">
                    {/* Tabs */}
                    <div ref={tabsContainerRef} className="flex pt-2 px-2 gap-1 overflow-x-auto custom-scrollbar no-scrollbar">
                        {openFiles.map(fileId => {
                            const isActive = fileId === selectedNodeId;
                            return (
                                <div 
                                    key={fileId}
                                    onClick={() => onSelectFile(fileId)}
                                    className={`
                                        group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[180px] cursor-pointer select-none rounded-t-md transition-all border-t border-x relative
                                        ${isActive 
                                            ? 'bg-[#121212] border-purple-500/50 text-zinc-200 border-b-0 z-10' 
                                            : 'bg-[#18181b] border-transparent text-zinc-500 hover:bg-[#27272a] hover:text-zinc-300 border-b-zinc-800 mt-0.5'}
                                    `}
                                >
                                    {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-md shadow-[0_0_10px_#8b5cf6]"></div>}
                                    <span className="shrink-0">{getFileIcon(fileId)}</span>
                                    <span className={`text-[11px] truncate flex-1 ${isActive ? 'font-medium' : ''}`}>{getFileName(fileId)}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onCloseFile(fileId); }}
                                        className={`p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all`}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Breadcrumbs & Toolbar */}
                    <div className="h-9 flex items-center justify-between px-4 bg-[#121212] border-t border-zinc-800/50">
                        <div className="flex items-center gap-1 text-[11px] text-zinc-500 overflow-hidden">
                            <Home size={12} className="mr-1 text-zinc-600" />
                            {breadcrumbs.map((part, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <ChevronRight size={10} className="text-zinc-700" />}
                                    <span className={`${idx === breadcrumbs.length - 1 ? 'text-zinc-300 font-medium' : 'hover:text-zinc-400 cursor-pointer'}`}>
                                        {part}
                                    </span>
                                </React.Fragment>
                            ))}
                            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-2 shadow-[0_0_5px_#f59e0b]" title="Unsaved"></span>}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-[#18181b] rounded-lg p-0.5 border border-zinc-800">
                                <button onClick={handleManualSave} className={`p-1.5 rounded hover:bg-zinc-700 transition-colors ${isDirty ? 'text-emerald-400' : 'text-zinc-500'}`} title="Save (Ctrl+S)">
                                    <Save size={14} />
                                </button>
                                <button onClick={() => editorRef.current?.trigger('source', 'editor.action.formatDocument')} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 transition-colors" title="Format Code">
                                    <AlignJustify size={14} />
                                </button>
                                <div className="w-px h-3 bg-zinc-800 mx-0.5"></div>
                                <button onClick={() => setShowAiInput(!showAiInput)} className={`p-1.5 rounded transition-all ${showAiInput ? 'bg-purple-600 text-white' : 'hover:bg-zinc-700 text-purple-400'}`} title="AI Assist">
                                    <Sparkles size={14} />
                                </button>
                            </div>
                            
                            {onRevealInGraph && (
                                <button onClick={onRevealInGraph} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-purple-400 transition-colors" title="Locate in Graph">
                                    <Network size={14} />
                                </button>
                            )}
                            <button onClick={() => setIsZenMode(!isZenMode)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Zen Mode">
                                {isZenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- AI COMMAND BAR --- */}
            {showAiInput && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] max-w-[90%] z-20 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="bg-[#18181b] border border-purple-500/50 rounded-xl shadow-2xl p-2 flex gap-2 items-center ring-4 ring-black/50 backdrop-blur-md">
                        <div className="pl-2"><Sparkles size={16} className="text-purple-400" /></div>
                        <input 
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
                            autoFocus
                            placeholder="Ask WIDDX AI to refactor, document, or debug this file..."
                            className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-zinc-500 focus:ring-0 outline-none font-mono"
                        />
                        <div className="flex gap-1">
                            <button onClick={handleAiSubmit} disabled={isAiProcessing} className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
                                {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                            <button onClick={() => setShowAiInput(false)} className="p-1.5 hover:bg-zinc-700 text-zinc-400 rounded-lg">
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- EDITOR --- */}
            <div className={`flex-1 overflow-hidden relative bg-[#121212] ${isZenMode ? 'px-[15%] py-8' : ''}`}>
                <div className={isZenMode ? 'h-full border border-zinc-800 shadow-2xl rounded-lg overflow-hidden ring-1 ring-white/5' : 'h-full'}>
                    <Editor
                        height="100%"
                        path={activeUri} // Uses file:// URI for proper Intellisense model mapping
                        language={selectedNodeId ? widdxGetLanguageFromPath(selectedNodeId) : 'plaintext'}
                        theme="widdx-charcoal"
                        value={editorContent}
                        onMount={handleEditorMount}
                        onChange={(val) => { setEditorContent(val || ''); setIsDirty(true); }}
                        options={{
                            minimap: { enabled: !isZenMode && editorSettings.minimap },
                            fontSize: 13,
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            fontLigatures: editorSettings.fontLigatures,
                            padding: { top: 16, bottom: 16 },
                            smoothScrolling: true,
                            bracketPairColorization: { enabled: true },
                            wordWrap: editorSettings.wordWrap ? 'on' : 'off',
                            lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
                            guides: { indentation: true, bracketPairs: true },
                            renderLineHighlight: 'all',
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            // Improve suggestions
                            suggest: {
                                preview: true,
                                showMethods: true,
                                showFunctions: true,
                                showConstructors: true,
                                showFields: true,
                                showVariables: true,
                                showClasses: true,
                                showStructs: true,
                                showInterfaces: true,
                                showModules: true,
                                showProperties: true,
                                showEvents: true,
                                showOperators: true,
                                showUnits: true,
                                showValues: true,
                                showConstants: true,
                                showEnums: true,
                                showEnumMembers: true,
                                showKeywords: true,
                                showWords: true,
                                showColors: true,
                                showFiles: true,
                                showReferences: true,
                                showFolders: true,
                                showTypeParameters: true,
                                showSnippets: true,
                            }
                        }}
                        loading={<div className="flex justify-center items-center h-full text-purple-500 bg-[#121212]"><Loader2 className="animate-spin mr-2" /> Loading Editor Engine...</div>}
                    />
                </div>
            </div>

            {/* --- FOOTER STATUS --- */}
            {!isZenMode && (
                <div className="h-6 bg-purple-900/30 border-t border-purple-500/20 text-purple-200 flex items-center justify-between px-3 text-[10px] select-none shrink-0 cursor-default">
                    <div className="flex items-center gap-4">
                       <span className="flex items-center gap-1 font-medium"><Code size={10} /> master*</span>
                       {/* Error / Warning count mock */}
                       <span className="flex items-center gap-1"><X size={10} className="text-white/60" /> 0</span> 
                       <span className="flex items-center gap-1"><AlertCircle size={10} className="text-white/60" /> 0</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><LayoutTemplate size={10} /> Ln {editorContent.split('\n').length}</span>
                        <span>UTF-8</span>
                        <span>{selectedNodeId ? widdxGetLanguageFromPath(selectedNodeId).toUpperCase() : 'TXT'}</span>
                        <span className="hover:bg-white/20 px-1 rounded cursor-pointer">Prettier</span>
                    </div>
                </div>
            )}

            {pendingAiContent && (
                <WiddxDiffReviewModal 
                    path={fileName || 'unknown'}
                    originalContent={editorContent}
                    newContent={pendingAiContent}
                    onApprove={() => { setEditorContent(pendingAiContent); setIsDirty(true); setPendingAiContent(null); }}
                    onReject={() => setPendingAiContent(null)}
                    lang={lang}
                />
            )}
        </div>
    );
};
