
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Bot, Loader2, Cpu, Workflow, Layers, CheckCircle, AlertCircle, ArrowUp, User, Palette, Server, ShieldCheck, PlayCircle, StopCircle, CornerDownRight, Check, Crosshair, Terminal, X, PanelRightClose, PanelLeftClose, Copy, Sparkles, Database, Brain, Compass, Settings2, ChevronDown, ChevronRight, Lightbulb, ToggleLeft, ToggleRight, Sliders, Globe, Github, Activity, Shield, Lock, Unlock, Users, MessageSquare, MousePointerClick, List } from 'lucide-react';
import { Type, FunctionDeclaration } from "@google/genai";
import { WiddxAiService, WiddxAgentRole, WiddxAgents } from '../services/widdxAiService';
import { McpService } from '../services/mcpService';
import { WiddxGraph } from '../types';
import { widdxSerializeGraphForAi } from '../services/widdxAnalysisUtils';
import { Language, translations } from '../services/i18n';
import { WiddxDiffReviewModal } from './WiddxDiffReviewModal';
import { WiddxProtocolType } from '../services/widdxProtocols';
import { SecurityService } from '../services/securityService';
import { StorageService } from '../services/storageService';
import { WiddxMarkdownRenderer } from './WiddxMarkdownRenderer';

interface WiddxChatPanelProps {
    selectedNodeId: string | null;
    totalFiles: number;
    graph?: WiddxGraph; 
    onUpdateFile: (path: string, content: string) => void;
    onCreateFile: (path: string) => void;
    onDeleteFile: (path: string) => void;
    onRenameFile: (oldPath: string, newPath: string) => void;
    onSelectNode: (id: string) => void;
    lang: Language;
    onAiProcessing?: (id: string | null) => void; 
    onClose?: () => void;
    projectId?: string;
}

interface ChatMessage {
    role: 'user' | 'model' | 'system';
    text: string;
    toolUsed?: string;
    isWelcome?: boolean;
    isError?: boolean;
    isSecurityBlock?: boolean;
    stepNumber?: number;
    agentRole?: WiddxAgentRole;
    isDebateEntry?: boolean; // Visual marker for debate parts
}

interface PendingAction {
    id: string; 
    name: string;
    args: any;
    originalContent: string;
    historySnapshot: any[];
}

interface ChatSettings {
    autoApprove: boolean; 
    collapseThinking: boolean;
    autoScroll: boolean; 
}

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
    autoApprove: false,
    collapseThinking: false,
    autoScroll: true
};

const getAgentIcon = (role: WiddxAgentRole) => {
    switch (role) {
        case 'ARCHITECT': return <Brain size={14} />;
        case 'FRONTEND': return <Palette size={14} />;
        case 'BACKEND': return <Server size={14} />;
        case 'QA': return <ShieldCheck size={14} />;
        case 'DEVOPS': return <Cpu size={14} />;
        case 'DATA': return <Database size={14} />;
        case 'AI_ENG': return <Sparkles size={14} />;
        case 'PRODUCT': return <Compass size={14} />;
        default: return <Bot size={14} />;
    }
};

const getAgentColor = (role: WiddxAgentRole) => {
    const profile = WiddxAgents[role];
    const color = profile?.color || 'zinc';
    return `border-${color}-500/30 text-${color}-400 shadow-${color}-500/10`;
};

export const WiddxChatPanel: React.FC<WiddxChatPanelProps> = ({
    selectedNodeId, totalFiles, graph, onUpdateFile, onCreateFile, onDeleteFile, onRenameFile, onSelectNode, lang, onAiProcessing, onClose, projectId
}) => {
    const t = translations[lang];
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAgentWorking, setIsAgentWorking] = useState(false);
    const [agentStatus, setAgentStatus] = useState<string>('');
    const [currentStep, setCurrentStep] = useState(0);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isAutoPilot, setIsAutoPilot] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<WiddxAgentRole>('ARCHITECT');
    const [isCouncilMode, setIsCouncilMode] = useState(false); 
    const [isSafeMode, setIsSafeMode] = useState(true); 

    const historyRef = useRef<any[]>([]);
    
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<ChatSettings>(() => {
        const saved = localStorage.getItem('WIDDX_CHAT_SETTINGS');
        return saved ? JSON.parse(saved) : DEFAULT_CHAT_SETTINGS;
    });
    const stopSignalRef = useRef(false);
    const graphRef = useRef(graph);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isRtl = lang === 'ar';

    useEffect(() => { graphRef.current = graph; }, [graph]);
    useEffect(() => { localStorage.setItem('WIDDX_CHAT_SETTINGS', JSON.stringify(settings)); }, [settings]);
    
    // Compute valid files set for the linker
    const validFilePaths = useMemo(() => {
        const paths = new Set<string>();
        if (graph?.nodes) {
            graph.nodes.forEach(n => {
                paths.add(n.id);
                // Also add filename without path for relaxed matching
                paths.add(n.name); 
            });
        }
        return paths;
    }, [graph]);

    useEffect(() => {
        if (!projectId || projectId === 'default') {
            setChatMessages([]);
            return;
        }
        StorageService.loadUiState(projectId, 'chat_history').then(history => {
            if (history && Array.isArray(history) && history.length > 0) {
                setChatMessages(history);
            } else if (graph) {
                const protocols = graph.widdxMeta.protocols || ['UNIVERSAL'];
                const protocolStr = protocols.join(' + ');
                const welcomeMsg = `${t.ai_welcome}\n\n**${t.project_state} (${protocolStr}):**\n- Files: ${totalFiles}`;
                setChatMessages([{ role: 'model', text: welcomeMsg, isWelcome: true, agentRole: 'ARCHITECT' }]);
            }
        });
    }, [projectId]); 

    useEffect(() => {
        if (chatMessages.length > 0 && projectId && projectId !== 'default') {
            StorageService.saveUiState(projectId, 'chat_history', chatMessages);
        }
    }, [chatMessages, projectId]);

    useEffect(() => { if (settings.autoScroll) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, agentStatus]);

    const getTools = (role: WiddxAgentRole): FunctionDeclaration[] => {
        const tools: FunctionDeclaration[] = [
            { name: "read_file", description: "Reads file content.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ["path"] } },
            { name: "search_project", description: "Search the Semantic Symbol Index for function/class definitions.", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },
            { name: "highlight_node", description: "Visually select/highlight a file in the graph.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ["path"] } },
            { name: "list_directory", description: "Lists files and folders in a specific directory path.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ["path"] } },
            { name: "delegate_task", description: "Hand off task to specialist (Frontend, Backend, etc).", parameters: { type: Type.OBJECT, properties: { target_role: { type: Type.STRING, enum: ['FRONTEND', 'BACKEND', 'QA', 'ARCHITECT', 'DEVOPS', 'DATA', 'AI_ENG', 'PRODUCT'] }, instruction: { type: Type.STRING } }, required: ["target_role", "instruction"] } },
            { name: "update_file", description: "Updates file content.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING }, content: { type: Type.STRING } }, required: ["path", "content"] } },
            { name: "create_file", description: "Creates new file.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ["path"] } },
            { name: "delete_file", description: "Removes file.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ["path"] } },
            { name: "rename_file", description: "Renames or moves a file.", parameters: { type: Type.OBJECT, properties: { old_path: { type: Type.STRING }, new_path: { type: Type.STRING } }, required: ["old_path", "new_path"] } },
            { name: "install_dependency", description: "Adds a dependency to package.json.", parameters: { type: Type.OBJECT, properties: { package: { type: Type.STRING }, version: { type: Type.STRING }, dev: { type: Type.BOOLEAN } }, required: ["package"] } },
        ];
        return tools;
    };

    // --- COUNCIL OF AGENTS ORCHESTRATION ---
    const runCouncilSession = async (userIntent: string) => {
        setIsAgentWorking(true);
        stopSignalRef.current = false;
        
        const historySnapshot = [...chatMessages, { role: 'user', text: userIntent }];
        
        // 1. ARCHITECT (CHAIRPERSON) ANALYZES & NOMINATES
        setSelectedAgent('ARCHITECT');
        setAgentStatus("Convener: Identifying specialists...");
        
        const nominationPrompt = `
        [SYSTEM: COUNCIL MODE ACTIVE]
        You are the Chairperson of the Council.
        Analyze the user's request: "${userIntent}".
        Identify strictly 2 other agents (e.g. FRONTEND and BACKEND) best suited to discuss this.
        
        OUTPUT FORMAT ONLY:
        NOMINATE: [AGENT_A, AGENT_B]
        STRATEGY: <One sentence summary of the plan>
        `;
        
        const archHistory = WiddxAiService.constructSandboxedHistory(historySnapshot, 'ARCHITECT');
        archHistory.push({ role: 'user', parts: [{ text: nominationPrompt }] });

        try {
            const archRes = await WiddxAiService.executeAgentTurn(archHistory, widdxSerializeGraphForAi(graphRef.current!), getTools('ARCHITECT'), 'ARCHITECT');
            
            // Parse Nomination
            const nomMatch = archRes.text.match(/NOMINATE: \[(.*?)\]/);
            let nominees: WiddxAgentRole[] = ['FRONTEND', 'BACKEND']; // Fallback
            
            if (nomMatch) {
                const rawRoles = nomMatch[1].split(',').map(s => s.trim().toUpperCase());
                const validRoles = rawRoles.filter(r => WiddxAgents[r as WiddxAgentRole]);
                if (validRoles.length >= 2) nominees = validRoles.slice(0, 2) as WiddxAgentRole[];
            }

            setChatMessages(prev => [...prev, { 
                role: 'model', 
                text: `**Council Convened.** \nNominees: ${nominees.map(n => WiddxAgents[n].name).join(' & ')}.\nStrategy: ${archRes.text.split('STRATEGY:')[1] || 'Analyzing...'}`, 
                agentRole: 'ARCHITECT',
                isDebateEntry: true
            }]);

            // 2. AGENT A (PROPOSAL)
            if (stopSignalRef.current) return;
            const agentA = nominees[0];
            setSelectedAgent(agentA);
            setAgentStatus(`${WiddxAgents[agentA].name}: Proposing Solution...`);
            
            const historyA = [...archHistory, { role: 'model', parts: [{ text: archRes.text }] }]; // Inherit context
            // Add directive for A
            historyA.push({ role: 'user', parts: [{ text: `[SYSTEM] You are ${agentA}. Propose a technical solution based on the strategy.` }] });
            
            const resA = await WiddxAiService.executeAgentTurn(historyA, widdxSerializeGraphForAi(graphRef.current!), getTools(agentA), agentA);
            setChatMessages(prev => [...prev, { role: 'model', text: resA.text, agentRole: agentA }]);

            // 3. AGENT B (CRITIQUE)
            if (stopSignalRef.current) return;
            const agentB = nominees[1];
            setSelectedAgent(agentB);
            setAgentStatus(`${WiddxAgents[agentB].name}: Reviewing & Critiquing...`);
            
            const historyB = [...historyA, { role: 'model', parts: [{ text: resA.text }] }];
            historyB.push({ role: 'user', parts: [{ text: `[SYSTEM] You are ${agentB}. Critically review the previous proposal. Identify risks or improvements.` }] });
            
            const resB = await WiddxAiService.executeAgentTurn(historyB, widdxSerializeGraphForAi(graphRef.current!), getTools(agentB), agentB);
            setChatMessages(prev => [...prev, { role: 'model', text: resB.text, agentRole: agentB }]);

            // 4. ARCHITECT (CONSENSUS & EXECUTION)
            if (stopSignalRef.current) return;
            setSelectedAgent('ARCHITECT');
            setAgentStatus("Chairperson: Finalizing & Executing...");
            
            const historyFinal = [...historyB, { role: 'model', parts: [{ text: resB.text }] }];
            historyFinal.push({ role: 'user', parts: [{ text: `[SYSTEM] Synthesize the debate. Execute the final approved solution using your tools.` }] });
            
            // Handover to standard loop for execution
            historyRef.current = historyFinal; 
            await runAgentLoop(historyFinal, 0, 'ARCHITECT');

        } catch (e: any) {
            console.error("Council Error", e);
            setChatMessages(prev => [...prev, { role: 'system', text: `Council Adjourned Unexpectedly: ${e.message}`, isError: true }]);
            setIsAgentWorking(false);
            setAgentStatus('');
        }
    };

    const runAgentLoop = async (history: any[], stepCounter: number, activeRoleOverride?: WiddxAgentRole) => {
        if (stopSignalRef.current || stepCounter >= 50) {
            setIsAgentWorking(false); setIsAutoPilot(false); setAgentStatus(''); if(onAiProcessing) onAiProcessing(null);
            return;
        }

        setIsAgentWorking(true);
        const currentRole = activeRoleOverride || selectedAgent;
        if (activeRoleOverride && activeRoleOverride !== selectedAgent) {
            setSelectedAgent(activeRoleOverride);
        }

        setAgentStatus(`${WiddxAgents[currentRole].name} ${t.analyzing} (${stepCounter})...`);
        setCurrentStep(stepCounter);

        try {
            const currentGraph = graphRef.current;
            const contextInfo = currentGraph ? widdxSerializeGraphForAi(currentGraph) : "VFS is empty.";
            const activeProtocols = currentGraph?.widdxMeta.protocols || ['UNIVERSAL'];
            const internalTools = getTools(currentRole);
            
            const result = await WiddxAiService.executeAgentTurn(history, contextInfo, internalTools, currentRole, activeProtocols);

            const modelTurnParts: any[] = [];
            if (result.text) modelTurnParts.push({ text: result.text });
            if (result.functionCalls && result.functionCalls.length > 0) {
                result.functionCalls.forEach(fc => {
                    modelTurnParts.push({ functionCall: { name: fc.name, args: fc.args, id: fc.id } });
                });
            }
            
            const newHistory = [...history, { role: 'model', parts: modelTurnParts }];
            historyRef.current = newHistory; 

            if (result.text) {
                setChatMessages(prev => [...prev, { role: 'model', text: result.text, agentRole: currentRole }]);
            }

            if (result.functionCalls?.length) {
                const functionResponses: any[] = [];
                let requiresUserAction = false;
                let delegationData = null;

                for (const call of result.functionCalls) {
                    const { name, args } = call;
                    const securityCheck = SecurityService.validateAction(name, args, isSafeMode);
                    
                    if (securityCheck.blocked) {
                        setChatMessages(prev => [...prev, { role: 'system', text: securityCheck.reason || "Operation blocked by security policy.", isSecurityBlock: true }]);
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { error: securityCheck.reason } } });
                        continue;
                    }

                    if (name.startsWith('mcp__')) {
                        setAgentStatus(`Calling MCP: ${name}...`);
                        const result = await McpService.executeTool(name, args);
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { result } } });
                    } else if (name === 'delegate_task') {
                        delegationData = { role: args.target_role, msg: args.instruction };
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { status: `Delegated to ${args.target_role}` } } });
                    } else if (name === 'read_file') {
                        const file = graphRef.current?.nodes.find(n => n.id === args.path);
                        const content = file?.content || "// File not found.";
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { content: content.substring(0, 5000) } } });
                    } else if (name === 'list_directory') {
                        const files = graphRef.current?.nodes.filter(n => n.parentId === args.path || n.id.startsWith(args.path)).map(n => n.name).join(', ') || "Empty or invalid path.";
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { files } } });
                    } else if (name === 'search_project') {
                        const results = [];
                        if (graphRef.current?.index) {
                            for (const [key, val] of graphRef.current.index.symbols) {
                                if (key.toLowerCase().includes(args.query.toLowerCase())) results.push(...val);
                            }
                        }
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { results: results.slice(0, 10) } } });
                    } else if (name === 'highlight_node') {
                        onSelectNode(args.path);
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { status: "Highlighted" } } });
                    } else if (['update_file', 'create_file', 'delete_file', 'rename_file'].includes(name)) {
                        if (!settings.autoApprove && !isAutoPilot) {
                            requiresUserAction = true;
                            let original = '';
                            if (name === 'update_file') {
                                original = graphRef.current?.nodes.find(n => n.id === args.path)?.content || '';
                            }
                            setPendingAction({ id: call.id, name, args, originalContent: original, historySnapshot: newHistory });
                            setIsAgentWorking(false);
                            return; 
                        } else {
                            if (name === 'update_file') onUpdateFile(args.path, args.content);
                            if (name === 'create_file') onCreateFile(args.path);
                            if (name === 'delete_file') onDeleteFile(args.path);
                            if (name === 'rename_file') onRenameFile(args.old_path, args.new_path);
                            functionResponses.push({ functionResponse: { name, id: call.id, response: { status: "Success" } } });
                            setChatMessages(prev => [...prev, { role: 'system', text: `Auto-executed: ${name} on ${args.path || args.old_path}` }]);
                        }
                    } else {
                        functionResponses.push({ functionResponse: { name, id: call.id, response: { error: "Unknown tool" } } });
                    }
                }

                if (!requiresUserAction) {
                    const nextHistory = [...newHistory, { role: 'function', parts: functionResponses }];
                    if (delegationData) {
                        setChatMessages(prev => [...prev, { role: 'system', text: `[SYSTEM] Handing off control to **${delegationData.role}**...`, agentRole: delegationData.role as WiddxAgentRole }]);
                        await runAgentLoop(nextHistory, stepCounter + 1, delegationData.role as WiddxAgentRole);
                    } else {
                        await runAgentLoop(nextHistory, stepCounter + 1, activeRoleOverride);
                    }
                }
            } else {
                setIsAgentWorking(false);
                setIsAutoPilot(false);
                setAgentStatus('');
                if(onAiProcessing) onAiProcessing(null);
            }

        } catch (error: any) {
            console.error("Agent Loop Error", error);
            setChatMessages(prev => [...prev, { role: 'model', text: `**System Error:** ${error.message}`, isError: true }]);
            setIsAgentWorking(false);
            setAgentStatus('');
        }
    };

    const handleSendMessage = () => {
        if (!chatInput.trim() || isAgentWorking) return;
        const msg = chatInput;
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
        
        if (isCouncilMode) {
            runCouncilSession(msg);
        } else {
            const history = WiddxAiService.constructSandboxedHistory(chatMessages, selectedAgent);
            history.push({ role: 'user', parts: [{ text: msg }] });
            stopSignalRef.current = false;
            runAgentLoop(history, 0);
        }
    };

    const handleApproveAction = () => {
        if (!pendingAction) return;
        const { name, args, historySnapshot, id } = pendingAction;

        if (name === 'update_file') onUpdateFile(args.path, args.content);
        if (name === 'create_file') onCreateFile(args.path);
        if (name === 'delete_file') onDeleteFile(args.path);
        if (name === 'rename_file') onRenameFile(args.old_path, args.new_path);

        const functionResponse = { functionResponse: { name, id: id, response: { status: "User Approved" } } };
        const nextHistory = [...historySnapshot, { role: 'function', parts: [functionResponse] }];
        
        setPendingAction(null);
        setChatMessages(prev => [...prev, { role: 'system', text: `Executed: ${name} on ${args.path}` }]);
        stopSignalRef.current = false;
        runAgentLoop(nextHistory, currentStep + 1, selectedAgent);
    };

    const handleRejectAction = () => {
        if (!pendingAction) return;
        const { name, historySnapshot, id } = pendingAction;
        
        const functionResponse = { functionResponse: { name, id: id, response: { error: "User Rejected Action" } } };
        const nextHistory = [...historySnapshot, { role: 'function', parts: [functionResponse] }];
        
        setPendingAction(null);
        setChatMessages(prev => [...prev, { role: 'system', text: `Rejected: ${name}` }]);
        stopSignalRef.current = false;
        runAgentLoop(nextHistory, currentStep + 1, selectedAgent);
    };

    // Helper to trigger node selection from within messages
    const handleLinkClick = (path: string) => {
        // Handle fuzzy matching if needed
        const node = graph?.nodes.find(n => n.id === path || n.id.endsWith(path) || n.name === path);
        if (node) {
            onSelectNode(node.id);
        }
    };

    return (
        <div className={`flex flex-col h-full bg-[#121212] relative border-l border-zinc-800 shadow-2xl transition-all duration-300 ${isCouncilMode ? 'bg-[#0f0b1e]' : 'bg-[#18181b]'}`}>
            
            {/* Header: Mode Switcher & Status */}
            <div className="flex flex-col border-b border-white/5 bg-white/[0.02] backdrop-blur-md z-10">
                <div className="flex items-center justify-between p-3">
                    
                    {/* Status Indicator */}
                    <div className="flex items-center gap-3">
                        <div className={`relative p-1.5 rounded-xl border ${isAgentWorking ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] animate-pulse' : 'border-zinc-700 bg-white/5'}`}>
                            {isAgentWorking ? <Loader2 size={16} className="animate-spin text-purple-400" /> : getAgentIcon(selectedAgent)}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#18181b] ${isAgentWorking ? 'bg-emerald-500' : 'bg-zinc-500'}`}></div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                                {isCouncilMode ? "Council Chamber" : WiddxAgents[selectedAgent].name}
                            </div>
                            <div className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate max-w-[150px]">
                                {agentStatus || (isCouncilMode ? "Waiting for session..." : "Online")}
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsSafeMode(!isSafeMode)} className={`p-2 rounded-lg transition-colors ${isSafeMode ? 'text-emerald-400 hover:bg-emerald-900/10' : 'text-red-400 hover:bg-red-900/10'}`} title="Toggle Safe Mode">
                            {isSafeMode ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            <Settings2 size={14} />
                        </button>
                        <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <PanelRightClose size={14} />
                        </button>
                    </div>
                </div>

                {/* Mode Segmented Control */}
                <div className="px-3 pb-3">
                    <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setIsCouncilMode(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${!isCouncilMode ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <MessageSquare size={12} /> Chat Mode
                        </button>
                        <button 
                            onClick={() => setIsCouncilMode(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${isCouncilMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Users size={12} /> Council
                        </button>
                    </div>
                </div>

                {/* Agent Scroll (Only in Chat Mode) */}
                {!isCouncilMode && (
                    <div className="px-3 pb-2 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar mask-fade-right">
                        {(Object.keys(WiddxAgents) as WiddxAgentRole[]).map(role => (
                            <button 
                                key={role} 
                                onClick={() => setSelectedAgent(role)}
                                className={`
                                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border whitespace-nowrap
                                    ${selectedAgent === role 
                                        ? `bg-${WiddxAgents[role].color}-500/20 text-${WiddxAgents[role].color}-400 border-${WiddxAgents[role].color}-500/50` 
                                        : 'border-transparent bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10'}
                                `}
                            >
                                {getAgentIcon(role)} {WiddxAgents[role].name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 relative">
                {isCouncilMode && chatMessages.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 opacity-30 pointer-events-none">
                        <Users size={48} className="mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Council Chamber Empty</p>
                    </div>
                )}

                {chatMessages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    const isSystem = msg.role === 'system';
                    
                    return (
                        <div key={i} className="animate-fade-in">
                            {msg.isDebateEntry && (
                                <div className="flex items-center justify-center my-6 opacity-60">
                                    <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent w-full max-w-[200px]"></div>
                                    <span className="mx-3 text-[9px] font-mono text-purple-400 uppercase tracking-widest flex items-center gap-1.5 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                        <Users size={10} /> Council Turn
                                    </span>
                                    <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent w-full max-w-[200px]"></div>
                                </div>
                            )}
                            
                            {isSystem ? (
                                <div className="flex justify-center my-2">
                                    <div className="bg-black/30 border border-zinc-800 rounded-full px-3 py-1 text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                                        <Terminal size={10} /> {msg.text}
                                    </div>
                                </div>
                            ) : (
                                <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} group`}>
                                    {!isUser && (
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 border shadow-sm ${getAgentColor(msg.agentRole || 'ARCHITECT')} bg-gradient-to-br from-[#27272a] to-black`}>
                                            {getAgentIcon(msg.agentRole || 'ARCHITECT')}
                                        </div>
                                    )}
                                    
                                    <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm text-sm relative ${
                                        isUser 
                                            ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-sm shadow-purple-900/20' 
                                            : 'bg-[#27272a]/80 backdrop-blur-sm border border-white/5 text-zinc-200 rounded-tl-sm'
                                    }`}>
                                        {!isUser && msg.agentRole && (
                                            <div className="flex items-center gap-2 mb-1.5 opacity-60">
                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${getAgentColor(msg.agentRole).replace('border-', 'text-').split(' ')[0]}`}>
                                                    {WiddxAgents[msg.agentRole].name}
                                                </span>
                                            </div>
                                        )}
                                        <WiddxMarkdownRenderer 
                                            content={msg.text} 
                                            role={msg.role} 
                                            defaultThinkingExpanded={!settings.collapseThinking} 
                                            validFilePaths={validFilePaths}
                                            onLinkClick={handleLinkClick}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {/* Pending Action Card */}
                {pendingAction && (
                    <div className="mx-2 my-4 border border-purple-500/40 bg-gradient-to-br from-[#1c192c] to-[#121212] rounded-xl overflow-hidden shadow-2xl animate-slide-up ring-1 ring-purple-500/20">
                        <div className="bg-purple-500/10 px-4 py-2 border-b border-purple-500/20 flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-300 flex items-center gap-2"><Cpu size={14} /> APPROVAL REQUIRED</span>
                            <span className="text-[9px] font-mono bg-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded">{pendingAction.name}</span>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="text-xs text-zinc-400 flex items-center gap-2 bg-black/20 p-2 rounded border border-white/5">
                                <span className="text-zinc-500">Target:</span>
                                <code className="text-purple-300 font-mono">{pendingAction.args.path || pendingAction.args.old_path}</code>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleApproveAction} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2">
                                    <Check size={14} /> Authorize
                                </button>
                                <button onClick={handleRejectAction} className="flex-1 bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 text-zinc-400 py-2 rounded-lg text-xs font-bold transition-all border border-zinc-700">
                                    Deny
                                </button>
                                {pendingAction.name === 'update_file' && (
                                    <button 
                                        onClick={() => setPendingAction({ ...pendingAction, showDiff: true } as any)} 
                                        className="px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-300"
                                        title="View Diff"
                                    >
                                        <Activity size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Diff Modal */}
                {pendingAction && (pendingAction as any).showDiff && (
                    <WiddxDiffReviewModal 
                        path={pendingAction.args.path}
                        originalContent={pendingAction.originalContent}
                        newContent={pendingAction.args.content}
                        onApprove={handleApproveAction}
                        onReject={() => setPendingAction(prev => ({...prev!, showDiff: false} as any))}
                        lang={lang}
                    />
                )}

                <div ref={chatEndRef} />
            </div>

            {/* Floating Input Area */}
            <div className="p-4 bg-transparent shrink-0 relative z-20">
                {showSettings && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 p-3 bg-[#18181b] rounded-xl border border-zinc-700 flex flex-wrap gap-4 text-xs animate-slide-up shadow-xl z-30">
                        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none hover:text-white transition-colors">
                            <input type="checkbox" checked={settings.autoApprove} onChange={e => setSettings(s => ({...s, autoApprove: e.target.checked}))} className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-0" />
                            Auto-Approve
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none hover:text-white transition-colors">
                            <input type="checkbox" checked={settings.collapseThinking} onChange={e => setSettings(s => ({...s, collapseThinking: e.target.checked}))} className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-0" />
                            Collapse Thinking
                        </label>
                    </div>
                )}
                
                <div className={`relative rounded-2xl shadow-2xl transition-all duration-300 ${isCouncilMode ? 'shadow-purple-900/20' : 'shadow-black/50'}`}>
                    <textarea 
                        ref={textareaRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder={isCouncilMode ? "Brief the Council on your mission..." : `Message ${WiddxAgents[selectedAgent].name}...`}
                        className={`w-full bg-[#1e1e24] border rounded-2xl pl-4 pr-12 py-3.5 text-sm text-zinc-200 focus:outline-none transition-all resize-none ${isCouncilMode ? 'border-purple-500/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 placeholder:text-purple-300/30' : 'border-zinc-700 focus:border-purple-500/50 placeholder:text-zinc-600'}`}
                        rows={1}
                        style={{ minHeight: '52px', maxHeight: '120px' }}
                        dir={isRtl ? 'rtl' : 'ltr'}
                    />
                    <div className="absolute right-2 bottom-2">
                        {isAgentWorking ? (
                            <button onClick={() => { stopSignalRef.current = true; setIsAgentWorking(false); }} className="p-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all" title="Stop Generation">
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button onClick={handleSendMessage} disabled={!chatInput.trim()} className={`p-2 text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg ${isCouncilMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                                {isCouncilMode ? <Users size={18} /> : <CornerDownRight size={18} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
