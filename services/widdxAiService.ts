
import { GoogleGenAI, FunctionDeclaration, GenerateContentResponse, Type, Schema } from "@google/genai";
import { ProtocolEngine } from "./widdxProtocols";
import { WiddxAgents, WiddxAgentRole } from "./agents";
import { McpService } from "./mcpService";
import { WiddxGraph } from '../types';
import { widdxSerializeGraphForAi } from './widdxAnalysisUtils';

export { WiddxAgents };
export type { WiddxAgentRole };

const PRIMARY_MODEL = 'gemini-3-pro-preview'; 

export const WiddxAiPreferences = {
    enableDeepSeekFallback: false,
    activeCore: 'GEMINI' as 'AUTO' | 'GEMINI' | 'DEEPSEEK',
};

const SMART_FIX_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        code: { type: Type.STRING, description: "The complete, corrected file content." },
        explanation: { type: Type.STRING, description: "Brief explanation of the fix." }
    },
    required: ["code", "explanation"]
};

const REFACTOR_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        code: { type: Type.STRING, description: "The refactored code content." },
        changes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of specific changes made." }
    },
    required: ["code"]
};

export interface AiContext {
    nodeId: string;
    graphSnapshot: WiddxGraph;
    mutationIntent: string;
}

export class WiddxAiService {
    
    private static getGeminiClient() {
        const key = process.env.API_KEY;
        if (!key) throw new Error("System Error: process.env.API_KEY is missing. Please configure the environment.");
        return new GoogleGenAI({ apiKey: key });
    }

    private static cleanError(error: any): Error {
        const msg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
        if (msg.includes('429') || msg.includes('quota')) return new Error("WIDDX Overload: Rate limit reached. Slowing down...");
        if (msg.includes('503')) return new Error("AI Model Busy. Retrying...");
        if (msg.includes('400') || msg.includes('413')) return new Error("Project Context Too Large. Pruning non-essential files...");
        if (msg.includes('404')) return new Error("Model Not Found. Verify API access.");
        return new Error(msg);
    }

    private static async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
        let lastError: any;
        for (let i = 0; i < maxRetries; i++) {
            try { return await fn(); } 
            catch (error: any) {
                lastError = error;
                const errStr = String(error);
                if (errStr.includes('404')) throw error;
                if (i === 0 && (errStr.includes('429') || errStr.includes('quota'))) {
                    await new Promise(resolve => setTimeout(resolve, 5000)); continue;
                }
                const isRetryable = errStr.includes('503') || errStr.includes('fetch');
                if (isRetryable && i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * baseDelay)); continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    public static constructSandboxedHistory(
        chatMessages: { role: string, text: string, agentRole?: WiddxAgentRole, toolUsed?: string }[], 
        activeRole: WiddxAgentRole
    ): any[] {
        return chatMessages.map(msg => {
            if (msg.role === 'user') {
                return { role: 'user', parts: [{ text: msg.text }] };
            }
            if (msg.role === 'system') {
                return { role: 'user', parts: [{ text: `[SYSTEM EVENT]: ${msg.text}` }] };
            }
            if (msg.role === 'model') {
                if (msg.agentRole === activeRole) {
                    return { role: 'model', parts: [{ text: msg.text }] };
                } else {
                    const speaker = msg.agentRole ? WiddxAgents[msg.agentRole].name : "Unknown Agent";
                    return { role: 'user', parts: [{ text: `[PREVIOUS AGENT (${speaker}) SAID]: ${msg.text}` }] };
                }
            }
            return null;
        }).filter(Boolean);
    }

    public static async executeAgentTurn(
        history: any[],
        contextInfo: string,
        internalTools: FunctionDeclaration[],
        activeRole: WiddxAgentRole = 'ARCHITECT',
        activeProtocolIds: string[] = ['UNIVERSAL']
    ) {
        const agent = WiddxAgents[activeRole];
        const protocol = await ProtocolEngine.loadCompositeProtocol(activeProtocolIds);
        const mcpTools = await McpService.fetchAllTools();
        const allTools = [...internalTools, ...mcpTools];

        const systemInstruction = `
        ${agent.systemPrompt}
        ${protocol.aiDirectives}

        === FILESYSTEM & CONFIG CONTEXT (PRE-LOADED) ===
        ${contextInfo}
        `;

        let safeHistory = history;
        // Aggressive history truncation to prevent 413 context errors
        if (history.length > 20) {
            safeHistory = [history[0], ...history.slice(history.length - 15)];
        }

        try {
            const ai = this.getGeminiClient();
            const config = { 
                temperature: 0.1, 
                systemInstruction,
                tools: [{ functionDeclarations: allTools }],
                thinkingConfig: { thinkingBudget: 2048 } // Enable thinking to prevent "missing thought signature" errors
            };
            
            const response = await this.retryWithBackoff<GenerateContentResponse>(() => 
                ai.models.generateContent({ model: PRIMARY_MODEL, contents: safeHistory, config })
            );

            return {
                text: response.text || '',
                functionCalls: response.functionCalls || [],
                rawResponse: response
            };

        } catch (error: any) {
            console.error("AI Error:", error);
            const friendlyError = this.cleanError(error);
            if (String(error).includes('404')) {
                 try {
                     const ai = this.getGeminiClient();
                     // Fallback to flash if pro not available or fails, without thinking config
                     const config = { temperature: 0.1, systemInstruction, tools: [{ functionDeclarations: allTools }] };
                     const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: safeHistory, config });
                     return { text: response.text || '', functionCalls: response.functionCalls || [], rawResponse: response };
                 } catch (fallbackError) {
                     throw friendlyError;
                 }
            }
            throw friendlyError;
        }
    }

    public static async generateSmartFix(
        missingPath: string, 
        globalContext: string, 
        importUsageHint: string, 
        userHint?: string,
        importerSnippet?: string
    ): Promise<string> {
        const prompt = `
        TASK: Generate the missing file '${missingPath}'.
        CONTEXT: 
        ${globalContext}
        
        USAGE HINT: ${importUsageHint}
        USER HINT: ${userHint || 'None'}
        IMPORTER SNIPPET: 
        ${importerSnippet}

        REQUIREMENT: Return valid code that satisfies the import.
        `;

        const ai = this.getGeminiClient();
        try {
            const response = await ai.models.generateContent({ 
                model: PRIMARY_MODEL, 
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: SMART_FIX_SCHEMA,
                    thinkingConfig: { thinkingBudget: 1024 }
                }
            });
            
            const json = JSON.parse(response.text || '{}');
            return json.code || '// Error generating code';
        } catch (e) {
            console.error("Smart Fix JSON Error", e);
            return '// Error: AI could not generate valid JSON.';
        }
    }

    public static async generateSmartFixV2(
        ctx: AiContext,
        importerId: string | null,
        userHint?: string
    ): Promise<string> {
        if (!ctx.graphSnapshot) throw new Error("Graph Snapshot missing");
        const globalContext = widdxSerializeGraphForAi(ctx.graphSnapshot);
        return this.generateSmartFix(ctx.nodeId, globalContext, `Imported by ${importerId}`, userHint);
    }

    public static async generateRefactor(code: string, instruction: string, fileName: string): Promise<string> {
        const prompt = `
        TASK: Refactor ${fileName}.
        INSTRUCTION: ${instruction}
        CODE:
        ${code}
        `;

        const ai = this.getGeminiClient();
        try {
            const response = await ai.models.generateContent({ 
                model: PRIMARY_MODEL, 
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: REFACTOR_SCHEMA,
                    thinkingConfig: { thinkingBudget: 1024 }
                }
            });
            const json = JSON.parse(response.text || '{}');
            return json.code || code;
        } catch (e) {
            return code;
        }
    }
}
