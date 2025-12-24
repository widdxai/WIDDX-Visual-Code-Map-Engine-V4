// @ts-nocheck
import { QualityAuditor } from '../qualityAuditor';
import { WiddxNode, WiddxNodeType, WiddxFlowStatus } from '../../types';
import { ProtocolEngine } from '../../widdxProtocols';

describe('QualityAuditor (Feature 2: Active Protocol Enforcement)', () => {

    const createNode = (id: string, content: string): WiddxNode => ({
        id,
        name: id,
        type: WiddxNodeType.FILE,
        size: content.split('\n').length,
        status: WiddxFlowStatus.VALID,
        content,
        parentId: '/'
    });

    it('should detect Protocol Violations for Chrome Extensions (MV3)', () => {
        const nodes = [
            createNode('background.js', `
                // This violates CSP
                const f = new Function("return true");
                eval("console.log('unsafe')");
            `)
        ];

        // Activate Chrome Protocol
        const { errors } = QualityAuditor.runStaticAnalysis(nodes, ['CHROME_EXT_V3']);

        const evalError = errors.find(e => e.message.includes("eval()"));
        const funcError = errors.find(e => e.message.includes("new Function()"));

        expect(evalError).toBeDefined();
        expect(evalError?.type).toBe('PROTOCOL_VIOLATION');
        expect(evalError?.severity).toBe('CRITICAL');

        expect(funcError).toBeDefined();
        expect(funcError?.type).toBe('PROTOCOL_VIOLATION');
    });

    it('should detect Missing Required Files for specific protocols', () => {
        const nodes = [createNode('popup.js', 'console.log("hi")')];
        
        // Chrome requires manifest.json
        const { errors } = QualityAuditor.runStaticAnalysis(nodes, ['CHROME_EXT_V3']);
        
        const missingManifest = errors.find(e => e.message.includes("Missing required file: 'manifest.json'"));
        expect(missingManifest).toBeDefined();
        expect(missingManifest?.severity).toBe('CRITICAL');
    });

    it('should detect Laravel specific violations', () => {
        const nodes = [
            createNode('app/Http/Controllers/UserController.php', `
                class UserController {
                    public function index() {
                        echo "Hello"; // Forbidden pattern
                        dd($user);    // Forbidden pattern
                    }
                }
            `)
        ];

        const { errors } = QualityAuditor.runStaticAnalysis(nodes, ['LARAVEL_MVC']);
        
        expect(errors.some(e => e.message.includes("'echo'"))).toBe(true);
        expect(errors.some(e => e.message.includes("'dd()'"))).toBe(true);
    });

    it('should NOT flag violations if protocol is NOT active', () => {
        const nodes = [
            createNode('background.js', `eval("console.log('unsafe')");`)
        ];

        // Run with just React protocol or Universal
        const { errors } = QualityAuditor.runStaticAnalysis(nodes, ['REACT_MODERN']);
        
        // Eval is not forbidden in React protocol specifically (though usually bad practice, it's not a strict rule in widdxProtocols.ts for React yet)
        const evalError = errors.find(e => e.message.includes("eval()"));
        expect(evalError).toBeUndefined();
    });
});