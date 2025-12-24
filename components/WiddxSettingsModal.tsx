
import React, { useEffect, useState } from 'react';
import { X, Cpu, Zap, ShieldCheck, Server, AlertTriangle, Key, Eye, EyeOff, Check, AlertCircle, Loader2, Edit3, Type, Minimize2, Map, List, AlignLeft, MousePointer2, Plug, Plus, Trash2, Globe, FileJson, Code, RefreshCw, Wifi, WifiOff, HardDrive, Lock, Layers } from 'lucide-react';
import { WiddxAiPreferences, WiddxAiService } from '../services/widdxAiService';
import { StorageService, EditorConfig, DEFAULT_EDITOR_CONFIG } from '../services/storageService';
import { McpService } from '../services/mcpService';
import { McpServerConfig } from '../types';
import { Language, translations } from '../services/i18n';
import { ProtocolEngine, WiddxProtocolType } from '../services/widdxProtocols';

interface WiddxSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
    onConfigUpdate?: (config: EditorConfig) => void;
    currentProtocols?: string[]; 
    onUpdateProtocols?: (protocols: WiddxProtocolType[]) => void;
}

export const WiddxSettingsModal: React.FC<WiddxSettingsModalProps> = ({ 
    isOpen, onClose, lang, onConfigUpdate, currentProtocols = [], onUpdateProtocols 
}) => {
    if (!isOpen) return null;

    // Editor Settings
    const [editorConfig, setEditorConfig] = useState<EditorConfig>(DEFAULT_EDITOR_CONFIG);

    // MCP Settings
    const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
    const [newMcpName, setNewMcpName] = useState('');
    const [newMcpUrl, setNewMcpUrl] = useState('');
    const [testingServerId, setTestingServerId] = useState<string | null>(null);
    
    // MCP JSON Mode
    const [mcpViewMode, setMcpViewMode] = useState<'list' | 'json'>('list');
    const [mcpJson, setMcpJson] = useState('');
    const [mcpJsonError, setMcpJsonError] = useState<string | null>(null);

    // Protocol Settings
    const [selectedProtocols, setSelectedProtocols] = useState<Set<WiddxProtocolType>>(new Set());

    const [activeTab, setActiveTab] = useState<'ai' | 'editor' | 'mcp' | 'arch' | 'system'>('editor');
    const [isClearing, setIsClearing] = useState(false);
    
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    const t = translations[lang];

    useEffect(() => {
        StorageService.loadSettings().then(settings => {
            if (settings.editor) setEditorConfig(settings.editor);
            if (settings.mcpServers) {
                setMcpServers(settings.mcpServers);
                McpService.setServers(settings.mcpServers);
            }
        });
        
        const validProtocols = (currentProtocols || []).filter(p => 
            ProtocolEngine.AVAILABLE_PROTOCOLS.some(ap => ap.id === p)
        ) as WiddxProtocolType[];
        
        setSelectedProtocols(new Set(validProtocols.length > 0 ? validProtocols : ['UNIVERSAL']));
    }, [isOpen, currentProtocols]);

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            let finalMcpServers = mcpServers;
            
            if (activeTab === 'mcp' && mcpViewMode === 'json') {
                try {
                    const parsed = JSON.parse(mcpJson);
                    if (!Array.isArray(parsed) && parsed.mcpServers) {
                        finalMcpServers = Object.keys(parsed.mcpServers).map(key => ({
                            id: key, name: key, url: parsed.mcpServers[key].url || '', status: 'disconnected', enabled: true, isCommandBased: !!parsed.mcpServers[key].command
                        }));
                    } else if (Array.isArray(parsed)) {
                        finalMcpServers = parsed;
                    }
                    setMcpServers(finalMcpServers);
                } catch (e) { }
            }

            McpService.setServers(finalMcpServers);

            await StorageService.saveSettings({
                editor: editorConfig,
                mcpServers: finalMcpServers
            });
            
            if (onConfigUpdate) onConfigUpdate(editorConfig);
            
            let protocolsToSave = Array.from(selectedProtocols);
            if (protocolsToSave.length === 0) protocolsToSave = ['UNIVERSAL'];
            
            if (onUpdateProtocols) onUpdateProtocols(protocolsToSave);

            setSaveStatus('success');
            setTimeout(() => {
                setSaveStatus('idle');
                onClose();
            }, 800);

        } catch (e) {
            console.error("Failed to save settings", e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    };

    const handleClearCache = async () => {
        if (!confirm("Are you sure? This will delete all local projects and reset settings.")) return;
        setIsClearing(true);
        try {
            await StorageService.clearAllData();
            localStorage.clear();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error(e);
            alert("Failed to clear cache.");
            setIsClearing(false);
        }
    };

    const handleAddMcp = () => {
        if (!newMcpName || !newMcpUrl) return;
        setMcpServers(prev => [...prev, {
            id: Date.now().toString(),
            name: newMcpName, url: newMcpUrl, status: 'disconnected', enabled: true
        }]);
        setNewMcpName(''); setNewMcpUrl('');
    };

    const handleRemoveMcp = (id: string) => {
        setMcpServers(prev => prev.filter(s => s.id !== id));
    };

    const handleTestMcp = async (server: McpServerConfig) => {
        if (!server.url) return;
        setTestingServerId(server.id);
        const isAlive = await McpService.pingServer(server.url);
        setMcpServers(prev => prev.map(s => s.id === server.id ? { ...s, status: isAlive ? 'connected' : 'error' } : s));
        setTestingServerId(null);
    };

    const toggleMcpViewMode = () => {
        if (mcpViewMode === 'list') {
            setMcpJson(JSON.stringify(mcpServers, null, 2));
            setMcpViewMode('json');
            setMcpJsonError(null);
        } else {
            try {
                JSON.parse(mcpJson); 
                setMcpViewMode('list');
                setMcpJsonError(null);
            } catch (e: any) {
                setMcpJsonError(e.message);
            }
        }
    };

    const toggleEditorSetting = (key: keyof EditorConfig) => {
        setEditorConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleProtocol = (id: WiddxProtocolType) => {
        const next = new Set(selectedProtocols);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedProtocols(next);
    };

    const ToggleRow = ({ label, desc, checked, onChange, icon: Icon }: any) => (
        <div className="flex items-start justify-between p-3 bg-[#18181b] border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all">
            <div className="flex gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-purple-500/10 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <div className="text-xs font-bold text-zinc-200">{label}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed max-w-[250px]">{desc}</div>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[600px] max-w-[95vw] bg-[#121212] border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 h-[80vh]">
                
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#18181b] shrink-0">
                    <div className="flex items-center gap-2">
                        <Edit3 className="text-purple-400" size={18} />
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">{t.settings}</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex items-center px-4 pt-4 gap-4 bg-[#121212] border-b border-zinc-800 shrink-0 overflow-x-auto">
                    <button onClick={() => setActiveTab('editor')} className={`pb-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'editor' ? 'text-purple-400 border-purple-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>{t.tab_editor}</button>
                    <button onClick={() => setActiveTab('arch')} className={`pb-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'arch' ? 'text-orange-400 border-orange-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>Architecture</button>
                    <button onClick={() => setActiveTab('ai')} className={`pb-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'ai' ? 'text-blue-400 border-blue-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>{t.tab_ai}</button>
                    <button onClick={() => setActiveTab('mcp')} className={`pb-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'mcp' ? 'text-emerald-400 border-emerald-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>{t.tab_mcp}</button>
                    <button onClick={() => setActiveTab('system')} className={`pb-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'system' ? 'text-red-400 border-red-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>{t.tab_system}</button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#121212]">
                    
                    {activeTab === 'editor' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Preferences</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <ToggleRow label="Text Wrapping" desc="The text wraps around edges." icon={AlignLeft} checked={editorConfig.wordWrap} onChange={() => toggleEditorSetting('wordWrap')} />
                                <ToggleRow label="Font Ligatures" desc="Render fira/jetbrains ligatures." icon={Type} checked={editorConfig.fontLigatures} onChange={() => toggleEditorSetting('fontLigatures')} />
                                <ToggleRow label="Minimap" desc="Render overview minimap." icon={Map} checked={editorConfig.minimap} onChange={() => toggleEditorSetting('minimap')} />
                                <ToggleRow label="Code Folding" desc="Allow collapsing blocks." icon={Minimize2} checked={editorConfig.folding} onChange={() => toggleEditorSetting('folding')} />
                                <ToggleRow label="Line Numbers" desc="Show line numbers." icon={List} checked={editorConfig.lineNumbers} onChange={() => toggleEditorSetting('lineNumbers')} />
                                <ToggleRow label="Sticky Scroll" desc="Keep context in view." icon={MousePointer2} checked={editorConfig.stickyScroll} onChange={() => toggleEditorSetting('stickyScroll')} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'arch' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Active Protocols</h3>
                            <p className="text-[10px] text-zinc-500 mb-4">Select the architectural patterns active in this project. This guides the AI and dependency resolution engine.</p>
                            <div className="space-y-2">
                                {ProtocolEngine.AVAILABLE_PROTOCOLS.map(p => (
                                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${selectedProtocols.has(p.id) ? 'bg-orange-500/10 border-orange-500/50' : 'bg-[#18181b] border-zinc-800 hover:border-zinc-700'}`} onClick={() => toggleProtocol(p.id)}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedProtocols.has(p.id) ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                {p.icon === 'Box' ? <Cpu size={16} /> : p.icon === 'Server' ? <Server size={16} /> : p.icon === 'Code' ? <Code size={16} /> : <Globe size={16} />}
                                            </div>
                                            <div>
                                                <div className={`text-xs font-bold ${selectedProtocols.has(p.id) ? 'text-orange-100' : 'text-zinc-300'}`}>{p.name}</div>
                                                <div className="text-[10px] text-zinc-500">{p.description}</div>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedProtocols.has(p.id) ? 'bg-orange-500 border-orange-500' : 'border-zinc-600'}`}>
                                            {selectedProtocols.has(p.id) && <Check size={10} className="text-white" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ... Other Tabs (AI, MCP, System) reused from original ... */}
                    {activeTab === 'ai' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="p-6 bg-[#18181b] border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <Lock size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-200">Environment Managed</h3>
                                    <p className="text-xs text-zinc-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
                                        API Keys are securely managed via the <code>process.env.API_KEY</code> environment variable. 
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono bg-[#121212] px-3 py-1.5 rounded border border-zinc-800">
                                    <Check size={12} className="text-emerald-500" /> System Ready
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... MCP Tab ... */}
                    {activeTab === 'mcp' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Plug size={20} /></div>
                                    <div>
                                        <div className="text-xs font-bold text-emerald-100">MCP Configuration</div>
                                        <div className="text-[10px] text-emerald-200/70">Connect External Tools via SSE/HTTP</div>
                                    </div>
                                </div>
                                <button onClick={toggleMcpViewMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${mcpViewMode === 'json' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                                    {mcpViewMode === 'list' ? <><Code size={12} /> Edit JSON</> : <><List size={12} /> Show List</>}
                                </button>
                            </div>

                            {mcpViewMode === 'list' ? (
                                <>
                                    <div className="space-y-3">
                                        {mcpServers.map(server => {
                                            const isTesting = testingServerId === server.id;
                                            return (
                                                <div key={server.id} className={`flex flex-col p-3 bg-[#18181b] border rounded-lg transition-all ${server.status === 'connected' ? 'border-emerald-500/30 shadow-sm' : 'border-zinc-800'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${server.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                                <Globe size={16} />
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                                                                    {server.name}
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${server.status === 'connected' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : server.status === 'error' ? 'bg-red-500' : 'bg-zinc-600'}`}></span>
                                                                </div>
                                                                <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]" title={server.url}>
                                                                    {server.url || <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={8} /> No URL (Bridge Required)</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={() => handleTestMcp(server)} 
                                                                disabled={isTesting || !server.url}
                                                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors disabled:opacity-30" 
                                                                title="Test Connection"
                                                            >
                                                                {isTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                            </button>
                                                            <button onClick={() => handleRemoveMcp(server.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="p-4 bg-[#18181b]/50 border border-zinc-800 rounded-lg border-dashed">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Add New HTTP/SSE Server</div>
                                        <div className="flex flex-col gap-3">
                                            <input 
                                                value={newMcpName} onChange={e => setNewMcpName(e.target.value)}
                                                placeholder="Server Name (e.g. Local Database)" 
                                                className="bg-[#121212] border border-zinc-700 text-xs text-zinc-200 rounded py-2 px-3 focus:outline-none focus:border-emerald-500"
                                            />
                                            <input 
                                                value={newMcpUrl} onChange={e => setNewMcpUrl(e.target.value)}
                                                placeholder="Endpoint URL (e.g. http://localhost:8000/sse)" 
                                                className="bg-[#121212] border border-zinc-700 text-xs text-zinc-200 rounded py-2 px-3 focus:outline-none focus:border-emerald-500"
                                            />
                                            <button onClick={handleAddMcp} className="flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-all">
                                                <Plus size={14} /> Add MCP Server
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-[300px] flex flex-col relative">
                                    <textarea
                                        value={mcpJson}
                                        onChange={(e) => setMcpJson(e.target.value)}
                                        className={`flex-1 w-full bg-[#121212] border rounded-lg p-3 font-mono text-xs focus:outline-none resize-none leading-relaxed ${mcpJsonError ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-800 focus:border-emerald-500'} text-zinc-300`}
                                        spellCheck={false}
                                        placeholder='Paste your MCP config here...'
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl space-y-4">
                                <div className="flex items-center gap-3 text-red-400">
                                    <AlertTriangle size={24} />
                                    <div>
                                        <div className="text-sm font-bold uppercase tracking-widest">{t.danger_zone}</div>
                                        <div className="text-[10px] opacity-70">Irreversible Actions</div>
                                    </div>
                                </div>
                                <div className="bg-[#121212]/50 p-4 rounded-lg border border-red-900/30 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-zinc-200">{t.clear_cache}</div>
                                        <div className="text-[10px] text-zinc-500 mt-1 max-w-[250px]">{t.clear_cache_desc}</div>
                                    </div>
                                    <button 
                                        onClick={handleClearCache} 
                                        disabled={isClearing}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600 border border-red-600/50 text-red-200 hover:text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        {isClearing ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
                                        {isClearing ? 'Cleaning...' : t.clear_cache}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-[#121212] border-t border-zinc-800 flex justify-end shrink-0">
                    <button 
                        onClick={handleSave}
                        disabled={saveStatus === 'saving' || saveStatus === 'success'}
                        className={`px-6 py-2 text-white text-xs font-bold rounded shadow-lg transition-all flex items-center gap-2 ${
                            saveStatus === 'error' ? 'bg-red-600 hover:bg-red-500' :
                            saveStatus === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' :
                            'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 active:scale-95'
                        }`}
                    >
                        {saveStatus === 'saving' && <Loader2 size={12} className="animate-spin" />}
                        {saveStatus === 'success' && <Check size={12} />}
                        {saveStatus === 'error' ? 'Error Saving' : saveStatus === 'success' ? 'Saved!' : t.apply}
                    </button>
                </div>
            </div>
        </div>
    );
};
