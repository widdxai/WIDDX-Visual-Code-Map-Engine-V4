// @ts-nocheck
import { StorageService } from '../storageService';

// Mock IndexedDB
const mockDB = {
    transaction: jest.fn(),
    objectStoreNames: { contains: jest.fn() },
    close: jest.fn()
};

const mockTx = {
    objectStore: jest.fn(),
    oncomplete: null as any,
    onerror: null as any
};

const mockStore = {
    put: jest.fn(),
    get: jest.fn(),
    clear: jest.fn()
};

// Override private method or mock implementation logic 
// Since StorageService opens DB internally, checking scoping via logic is best
// Ideally we would use fake-indexeddb for full integration, but unit testing logic is sufficient if we verify key construction

describe('StorageService (Feature 3: Project Scoped Storage)', () => {
    
    beforeAll(() => {
        // Simple mock injection
        global.indexedDB = {
            open: () => ({
                result: mockDB,
                onupgradeneeded: null,
                onsuccess: function() { if(this.onsuccess) this.onsuccess({ target: { result: mockDB } }); },
                onerror: null
            })
        } as any;

        mockDB.transaction.mockReturnValue(mockTx);
        mockTx.objectStore.mockReturnValue(mockStore);
        mockDB.objectStoreNames.contains.mockReturnValue(true);
    });

    it('should save data using Project ID namespaced keys', async () => {
        const projectId = 'proj_123';
        const key = 'chat_history';
        const data = [{ msg: 'hello' }];

        mockStore.put.mockClear();
        
        // Mock success immediately
        setTimeout(() => { if(mockTx.oncomplete) mockTx.oncomplete(); }, 0);

        await StorageService.saveUiState(projectId, key, data);

        expect(mockStore.put).toHaveBeenCalledWith({
            key: 'proj_123::chat_history', // THE NAMESPACED KEY
            data: data
        });
    });

    it('should prevent data bleeding by loading with Project ID', async () => {
        const projectId = 'proj_456';
        const key = 'chat_history';
        const mockResult = { result: { data: 'project_b_data' }, onsuccess: null as any };

        mockStore.get.mockReturnValue(mockResult);
        setTimeout(() => { if(mockResult.onsuccess) mockResult.onsuccess(); }, 0);

        await StorageService.loadUiState(projectId, key);

        expect(mockStore.get).toHaveBeenCalledWith('proj_456::chat_history');
    });
});