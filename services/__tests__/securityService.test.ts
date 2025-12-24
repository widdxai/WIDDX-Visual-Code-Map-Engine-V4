// @ts-nocheck
import { SecurityService } from '../securityService';

describe('SecurityService (Feature 8: Security Firewall)', () => {
    
    describe('validateAction', () => {
        it('should BLOCK modifications to restricted files in Safe Mode', () => {
            const sensitiveFiles = [
                '.env',
                '.env.local',
                'id_rsa',
                'secret.key',
                '.git/HEAD',
                'package-lock.json'
            ];

            sensitiveFiles.forEach(file => {
                const result = SecurityService.validateAction('update_file', { path: file }, true);
                expect(result.blocked).toBe(true);
                expect(result.reason).toContain('SECURITY BLOCK');
            });
        });

        it('should ALLOW modifications to restricted files when Safe Mode is OFF', () => {
            const result = SecurityService.validateAction('update_file', { path: '.env' }, false);
            expect(result.blocked).toBe(false);
        });

        it('should ALLOW modifications to regular files in Safe Mode', () => {
            const regularFiles = [
                'src/App.tsx',
                'components/Header.js',
                'styles.css',
                'readme.md'
            ];

            regularFiles.forEach(file => {
                const result = SecurityService.validateAction('update_file', { path: file }, true);
                expect(result.blocked).toBe(false);
            });
        });

        it('should allow READ operations regardless of file type', () => {
            const readTools = ['read_file', 'list_directory', 'search_project'];
            
            readTools.forEach(tool => {
                const result = SecurityService.validateAction(tool, { path: '.env' }, true);
                expect(result.blocked).toBe(false);
            });
        });

        it('should flag Critical Configs but NOT block them (Soft Warning)', () => {
            // Depending on implementation, this might return blocked=false but with a specific reason
            // logic in SecurityService currently returns blocked: false for critical configs but handles reasoning internally/UI side
            const result = SecurityService.validateAction('update_file', { path: 'package.json' }, true);
            expect(result.blocked).toBe(false); 
            // Ideally check if it flags "CRITICAL_MODIFICATION" if the return type supports it
            expect(result.reason).toBe("CRITICAL_MODIFICATION");
        });
    });
});