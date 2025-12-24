
/**
 * WIDDX SECURITY PROTOCOL
 * -----------------------
 * Acts as a firewall between the AI Agent and the Virtual File System.
 */

export type SecurityLevel = 'STRICT' | 'PERMISSIVE';

export interface SecurityViolation {
    blocked: boolean;
    reason?: string;
}

export class SecurityService {
    
    // Files that should NEVER be modified by AI without explicit overrides
    private static readonly RESTRICTED_PATTERNS = [
        /\.env.*/i,           // Environment variables
        /\.pem$/i,            // Private keys
        /\.key$/i,
        /id_rsa/i,
        /\.git\//i,           // Git history
        /node_modules\//i,    // Dependencies (should be handled via package.json)
        /package-lock\.json$/i,
        /yarn\.lock$/i,
        /pnpm-lock\.yaml$/i
    ];

    // Files that require extra caution (Critical Configs)
    private static readonly CRITICAL_CONFIGS = [
        /package\.json$/i,
        /tsconfig\.json$/i,
        /next\.config\./i,
        /vite\.config\./i,
        /webpack\.config\./i
    ];

    /**
     * Validates if a tool execution is permissible under current security settings.
     */
    public static validateAction(
        toolName: string, 
        args: any, 
        isSafeMode: boolean
    ): SecurityViolation {
        // Read operations are generally safe
        if (['read_file', 'list_directory', 'search_project', 'highlight_node', 'delegate_task'].includes(toolName)) {
            return { blocked: false };
        }

        // Check Write Operations
        if (['update_file', 'create_file', 'delete_file', 'rename_file'].includes(toolName)) {
            const targetPath = args.path || args.old_path;
            
            if (!targetPath) return { blocked: false }; // Should be caught by schema validation

            // 1. Check Restricted Files (Always blocked in Safe Mode)
            if (isSafeMode && this.isRestricted(targetPath)) {
                return { 
                    blocked: true, 
                    reason: `SECURITY BLOCK: Modification of sensitive file '${targetPath}' is prevented in Safe Mode. Please disable Safe Mode to proceed.` 
                };
            }

            // 2. Check Critical Configs (Warning context, but blocked if Strict)
            if (isSafeMode && this.isCritical(targetPath)) {
                 return {
                     blocked: false, // We allow it but UI should warn heavily. For now, we pass but logic elsewhere handles diffs.
                     reason: "CRITICAL_MODIFICATION"
                 };
            }
        }

        // Install Dependencies
        if (toolName === 'install_dependency' && isSafeMode) {
            // Generally allow, but could restrict malicious packages in future
            return { blocked: false };
        }

        return { blocked: false };
    }

    private static isRestricted(path: string): boolean {
        return this.RESTRICTED_PATTERNS.some(regex => regex.test(path));
    }

    private static isCritical(path: string): boolean {
        return this.CRITICAL_CONFIGS.some(regex => regex.test(path));
    }
}
