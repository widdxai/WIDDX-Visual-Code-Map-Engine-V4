
import { WiddxNode, WiddxNodeType, WiddxFlowStatus } from '../../types';

export class FileProcessor {
    
    // Safety Limits - INCREASED SIGNIFICANTLY to allow almost anything
    private static readonly MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
    private static readonly MAX_LINES_PER_FILE = 200000; // 200k Lines

    public static createNodesFromFiles(fileMap: Map<string, string>): { nodes: WiddxNode[], validNodeIds: Set<string>, folderPaths: Set<string> } {
        const nodes: WiddxNode[] = [];
        const validNodeIds = new Set<string>();
        const folderPaths = new Set<string>();

        // 1. إضافة المجلد الجذري كقاعدة
        folderPaths.add('/');

        fileMap.forEach((content, path) => {
            const fileName = path.split('/').pop() || '';
            
            // Initial strict check - DISABLED for "No Skip" mode
            // if (this.shouldIgnoreFile(path, fileName)) return;

            // Size Check (Performance Safeguard) - Relaxed
            if (content.length > this.MAX_FILE_SIZE_BYTES) {
                console.warn(`Skipping huge file: ${path} (${(content.length/1024/1024).toFixed(1)}MB) - exceeds 50MB safety limit.`);
                return;
            }

            const lineCount = content.split('\n').length;
            // Skip massive generated files - Relaxed
            if (lineCount > this.MAX_LINES_PER_FILE) {
                 console.warn(`Skipping file with too many lines: ${path}`);
                 return;
            }

            // تحديد المجلد الأب
            const lastSlashIndex = path.lastIndexOf('/');
            let parentDir: string | null = '/';
            
            if (lastSlashIndex > 0) {
                parentDir = path.substring(0, lastSlashIndex);
            } else if (path === '/') {
                parentDir = null;
            }

            // إضافة كافة المجلدات في المسار إلى قائمة المجلدات
            if (parentDir && parentDir !== '/') {
                const parts = parentDir.split('/').filter(Boolean);
                let currentPath = '';
                parts.forEach(part => {
                    currentPath += '/' + part;
                    folderPaths.add(currentPath);
                });
            }

            nodes.push({
                id: path,
                name: fileName,
                type: WiddxNodeType.FILE,
                size: lineCount,
                status: WiddxFlowStatus.ORPHAN,
                content: content,
                parentId: parentDir
            });
            validNodeIds.add(path);
        });

        // 2. إنشاء عقد المجلدات
        folderPaths.forEach(folderPath => {
            // DISABLED Folder ignore check
            // if (this.shouldIgnoreFolder(folderPath)) return;
            
            if (validNodeIds.has(folderPath)) {
                const existingNode = nodes.find(n => n.id === folderPath);
                if (existingNode && existingNode.type === WiddxNodeType.FILE) {
                    return; 
                }
            }

            const lastSlashIndex = folderPath.lastIndexOf('/');
            let parentOfFolder: string | null = null;
            
            if (folderPath !== '/') {
                parentOfFolder = lastSlashIndex > 0 ? folderPath.substring(0, lastSlashIndex) : '/';
            }

            nodes.push({
                id: folderPath,
                name: folderPath === '/' ? 'root' : (folderPath.split('/').pop() || 'Folder'),
                type: WiddxNodeType.FOLDER,
                size: 0,
                status: WiddxFlowStatus.VALID,
                parentId: parentOfFolder
            });
            validNodeIds.add(folderPath);
        });

        return { nodes, validNodeIds, folderPaths };
    }

    private static shouldIgnoreFile(path: string, fileName: string): boolean {
        // Force include EVERYTHING
        return false;
    }

    private static shouldIgnoreFolder(folderPath: string): boolean {
        // Force include EVERYTHING
        return false;
    }
}
