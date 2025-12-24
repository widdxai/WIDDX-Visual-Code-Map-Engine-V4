
import { McpServerConfig, McpTool } from '../types';
import { FunctionDeclaration, Type } from "@google/genai";

// This is a simplified HTTP-JSON-RPC Client for MCP (Since browsers can't do raw TCP/Stdio)
// It assumes the MCP server exposes an HTTP/SSE endpoint.
export class McpService {
    private static servers: McpServerConfig[] = [];
    private static toolCache: Map<string, { tool: McpTool, serverUrl: string }> = new Map();

    public static setServers(servers: McpServerConfig[]) {
        this.servers = servers.filter(s => s.enabled && s.url && !s.url.startsWith('npx')); // Filter out CLI commands
    }

    public static async pingServer(url: string): Promise<boolean> {
        try {
            // Attempt to hit a /tools/list endpoint or just HEAD check
            // Most MCP HTTP adapters provide a /sse or POST endpoint. 
            // We'll try a dummy list request.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const res = await fetch(`${url}/tools/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return res.ok;
        } catch (e) {
            console.warn(`Ping failed for ${url}`, e);
            return false;
        }
    }

    public static async fetchAllTools(): Promise<FunctionDeclaration[]> {
        this.toolCache.clear();
        const geminiTools: FunctionDeclaration[] = [];

        for (const server of this.servers) {
            try {
                // In a real implementation, this would connect via SSE or HTTP Post
                // Assuming a standardized /tools endpoint for HTTP-based MCP adapters
                const tools = await this.fetchToolsFromServer(server.url);
                
                tools.forEach(tool => {
                    // Prefix tool name to avoid collisions and identify server
                    const uniqueName = `mcp__${server.name.replace(/\s+/g, '_')}__${tool.name}`;
                    this.toolCache.set(uniqueName, { tool, serverUrl: server.url });
                    
                    geminiTools.push(this.convertToGeminiTool(tool, uniqueName));
                });
            } catch (e) {
                console.warn(`Failed to fetch tools from MCP server ${server.name}:`, e);
            }
        }
        return geminiTools;
    }

    public static async executeTool(name: string, args: any): Promise<any> {
        const cached = this.toolCache.get(name);
        if (!cached) throw new Error(`MCP Tool ${name} not found.`);

        const originalName = cached.tool.name;
        
        try {
            // Simplified Call: POST JSON-RPC to the server endpoint
            // Real MCP over HTTP might use a specific session ID from SSE
            const response = await fetch(`${cached.serverUrl}/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: {
                        name: originalName,
                        arguments: args
                    },
                    id: 1
                })
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            const json = await response.json();
            
            if (json.error) throw new Error(json.error.message);
            
            // MCP result structure: { content: [{ type: 'text', text: '...' }] }
            return json.result?.content?.[0]?.text || JSON.stringify(json.result);

        } catch (e: any) {
            return `MCP Execution Error: ${e.message}`;
        }
    }

    private static async fetchToolsFromServer(url: string): Promise<McpTool[]> {
        // Attempt to hit a /tools list endpoint
        // This expects the MCP server to implement a simple HTTP adapter
        const res = await fetch(`${url}/tools/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 })
        });
        const json = await res.json();
        return json.result?.tools || [];
    }

    private static convertToGeminiTool(mcpTool: McpTool, uniqueName: string): FunctionDeclaration {
        // Convert JSON Schema to Gemini Type
        // This is a naive conversion; robust conversion requires deep recursion
        return {
            name: uniqueName,
            description: `[EXTERNAL MCP] ${mcpTool.description || ''}`,
            parameters: this.mapSchema(mcpTool.inputSchema)
        };
    }

    private static mapSchema(schema: any): any {
        if (!schema) return undefined;
        // Basic mapping for Type.OBJECT, Type.STRING etc.
        // Google GenAI expects capitalized types in some SDK versions, but 'string'/'object' usually works.
        // We will pass the schema as-is but ensure 'type' is set correctly if missing.
        return {
            type: Type.OBJECT,
            properties: schema.properties,
            required: schema.required
        };
    }
}
