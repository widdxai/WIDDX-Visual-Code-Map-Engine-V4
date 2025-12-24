// @ts-nocheck
import { ProjectRuntime } from '../projectRuntime';
import { WiddxEngine } from '../widdxEngine';
import { StorageService } from '../storageService';

// Mock Dependencies
jest.mock('../widdxEngine');
jest.mock('../storageService');

describe('ProjectRuntime (Feature 1: Truth Drift Mitigation)', () => {
    let runtime: ProjectRuntime;

    beforeEach(() => {
        // Reset singleton for testing (requires accessing private instance or adding a reset method to class)
        // Using public reset method
        runtime = ProjectRuntime.get();
        runtime.reset();
        
        // Reset mocks
        (WiddxEngine.analyzeProject as jest.Mock).mockClear();
        (StorageService.saveFiles as jest.Mock).mockImplementation(async () => {});
        (StorageService.clearFiles as jest.Mock).mockImplementation(async () => {});
    });

    it('should trigger reconcileGraph (Full Analysis) after 50 mutations', async () => {
        // Setup initial state
        const initialFiles = [{ path: 'test.js', content: '' }];
        (WiddxEngine.analyzeProject as jest.Mock).mockResolvedValue({
            widdxMeta: { manifest: { name: 'test' } }, // partial mock
            nodes: [],
            edges: [],
            virtualFileSystem: initialFiles,
            version: 1
        });

        await runtime.ingest(initialFiles);
        expect(WiddxEngine.analyzeProject).toHaveBeenCalledTimes(1); // Initial load

        // Simulate 50 mutations (Threshold is > 50)
        for (let i = 0; i < 50; i++) {
            runtime.applyMutation('UPDATE', 'test.js', `update ${i}`);
        }

        // reconcileGraph is async and floating, might need to wait a tick
        // At exactly 50, it shouldn't trigger yet (if logic is > 50)
        // Code check: if (this.mutationCount > 50)
        expect(WiddxEngine.analyzeProject).toHaveBeenCalledTimes(1);

        // Trigger 51st mutation
        runtime.applyMutation('UPDATE', 'test.js', 'trigger');
        
        // Reconcile is triggered (async). Wait for promises.
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(WiddxEngine.analyzeProject).toHaveBeenCalledTimes(2);
    });

    it('should maintain Single Source of Truth by passing current files to engine', async () => {
        const initialFiles = [{ path: 'a.js', content: 'v1' }];
        
        (WiddxEngine.analyzeProject as jest.Mock).mockResolvedValue({
            widdxMeta: { manifest: { name: 'test' } },
            nodes: [],
            edges: [],
            virtualFileSystem: initialFiles,
            version: 1
        });

        await runtime.ingest(initialFiles);

        // Mutate local state
        runtime.applyMutation('UPDATE', 'a.js', 'v2');
        
        // Force Reconcile
        // We simulate the call that happens internally
        // The test verifies that analyzeProject is called with the LATEST files from Runtime
        
        // Manually trigger many updates to force internal reconcile
        for(let i=0; i<52; i++) runtime.applyMutation('UPDATE', 'a.js', `v${i+3}`);
        
        await new Promise(resolve => setTimeout(resolve, 10));

        const calls = (WiddxEngine.analyzeProject as jest.Mock).mock.calls;
        const lastCallArgs = calls[calls.length - 1];
        const passedFiles = lastCallArgs[0];

        // Expect the engine to receive the LATEST content, not the old initial content
        expect(passedFiles[0].content).toContain('v5'); 
    });
});