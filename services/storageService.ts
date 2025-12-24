import { WiddxFileEntry, McpServerConfig } from '../types';

const DB_NAME = 'WIDDX_VDE_DB';
const STORE_FILES = 'vfs_files';
const STORE_SETTINGS = 'app_settings'; 
const STORE_UI_STATE = 'ui_state'; // New store for layout/chat
const DB_VERSION = 7; // Ensure version is high enough to create new stores

export interface EditorConfig {
    wordWrap: boolean;
    fontLigatures: boolean;
    minimap: boolean;
    folding: boolean;
    lineNumbers: boolean;
    stickyScroll: boolean;
    renderIndentGuides: boolean;
}

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
    wordWrap: false,
    fontLigatures: true,
    minimap: false,
    folding: true,
    lineNumbers: true,
    stickyScroll: true,
    renderIndentGuides: true
};

export interface AppSettings {
    editor?: EditorConfig;
    mcpServers?: McpServerConfig[];
}

export class StorageService {
    private static db: IDBDatabase | null = null;
    private static isOpening = false;

    private static async getDB(): Promise<IDBDatabase> {
        if (this.db) {
            try {
                // Verify connection is alive
                const tx = this.db.transaction(STORE_SETTINGS, 'readonly');
                tx.abort(); 
                return this.db;
            } catch (e) {
                console.warn("DB connection stale, reopening...");
                this.db = null;
            }
        }

        // Prevent race conditions during opening
        if (this.isOpening) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (this.db) return this.db;
        }

        this.isOpening = true;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_FILES)) {
                    db.createObjectStore(STORE_FILES, { keyPath: 'path' });
                }
                if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                    db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_UI_STATE)) {
                    db.createObjectStore(STORE_UI_STATE, { keyPath: 'key' });
                }
            };

            request.onblocked = () => {
                console.warn("DB Open Blocked: Closing old connections...");
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isOpening = false;
                
                this.db.onversionchange = () => {
                    this.db?.close();
                    this.db = null;
                    console.log("Database version changed elsewhere, closing connection.");
                };

                resolve(this.db);
            };

            request.onerror = () => {
                this.isOpening = false;
                console.error("IndexedDB Error:", request.error);
                reject(request.error);
            };
        });
    }

    public static async saveFiles(files: WiddxFileEntry[]): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_FILES, 'readwrite');
                const store = transaction.objectStore(STORE_FILES);
                store.clear(); 
                files.forEach(file => store.put(file));
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (e) {
            console.error("Failed to save files:", e);
        }
    }

    public static async loadFiles(): Promise<WiddxFileEntry[]> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_FILES, 'readonly');
                const store = transaction.objectStore(STORE_FILES);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("Failed to load files:", e);
            return [];
        }
    }

    public static async clearFiles(): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_FILES, 'readwrite');
                const store = transaction.objectStore(STORE_FILES);
                store.clear();
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (e) {
            console.error("Failed to clear files:", e);
        }
    }

    public static async saveSettings(settings: AppSettings): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_SETTINGS, 'readwrite');
                const store = transaction.objectStore(STORE_SETTINGS);
                const request = store.put({ id: 'config', ...settings });
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = (e) => {
                    console.error("Settings Transaction Error:", transaction.error);
                    reject(transaction.error);
                };
            });
        } catch (e) {
            console.error("Save Settings Failed:", e);
            throw e;
        }
    }

    public static async loadSettings(): Promise<AppSettings> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                    resolve({});
                    return;
                }

                const transaction = db.transaction(STORE_SETTINGS, 'readonly');
                const store = transaction.objectStore(STORE_SETTINGS);
                const request = store.get('config');
                
                request.onsuccess = () => resolve(request.result || {});
                request.onerror = () => {
                    console.warn("Error loading settings:", request.error);
                    reject(request.error);
                };
            });
        } catch (e) {
            console.warn("Load Settings Exception:", e);
            return {};
        }
    }

    /**
     * Saves UI state scoped to a specific project to prevent data bleeding.
     * @param projectId - The unique identifier for the current project context.
     * @param key - The specific UI element key (e.g., 'chat_history', 'open_files').
     * @param data - The data to persist.
     */
    public static async saveUiState(projectId: string, key: string, data: any): Promise<void> {
        try {
            const db = await this.getDB();
            const scopedKey = `${projectId}::${key}`;
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_UI_STATE, 'readwrite');
                const store = transaction.objectStore(STORE_UI_STATE);
                store.put({ key: scopedKey, data });
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (e) {
            console.warn("Save UI State Failed", e);
        }
    }

    /**
     * Loads UI state scoped to a specific project.
     * @param projectId - The unique identifier for the current project context.
     * @param key - The specific UI element key.
     */
    public static async loadUiState(projectId: string, key: string): Promise<any> {
        try {
            const db = await this.getDB();
            const scopedKey = `${projectId}::${key}`;
            return new Promise((resolve, reject) => {
                if (!db.objectStoreNames.contains(STORE_UI_STATE)) {
                    resolve(null);
                    return;
                }
                const transaction = db.transaction(STORE_UI_STATE, 'readonly');
                const store = transaction.objectStore(STORE_UI_STATE);
                const request = store.get(scopedKey);
                request.onsuccess = () => resolve(request.result?.data || null);
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    public static async clearAllData(): Promise<void> {
        try {
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            // Explicitly delete the database
            const req = indexedDB.deleteDatabase(DB_NAME);
            
            return new Promise((resolve, reject) => {
                req.onsuccess = () => {
                    console.log("Database deleted successfully");
                    resolve();
                };
                req.onerror = () => {
                    console.error("Error deleting database", req.error);
                    reject(req.error);
                };
                req.onblocked = () => {
                    console.warn("Database delete blocked");
                };
            });
        } catch (e) {
            console.error("Clear All Data Failed", e);
            throw e;
        }
    }
}