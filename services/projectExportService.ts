
import JSZip from 'jszip';
import { WiddxFileEntry } from '../types';

export class ProjectExportService {
    
    /**
     * Exports the project files to a ZIP archive with robust path handling.
     * Handles both text content and Base64 encoded binaries (images/assets).
     */
    public static async exportToZip(files: WiddxFileEntry[], projectName: string = 'widdx-project'): Promise<void> {
        if (!files || files.length === 0) {
            throw new Error("No files to export.");
        }

        const zip = new JSZip();
        
        // Helper to detect if content is Base64 Data URI
        const isBase64Data = (content: string) => content.startsWith('data:') && content.includes(';base64,');

        files.forEach(file => {
            // 1. Path Normalization (Crucial for extraction integrity)
            // Removes leading slashes, dot-slashes, and converts windows backslashes
            let cleanPath = file.path.trim()
                .replace(/\\/g, '/')      // Convert Windows backslashes
                .replace(/^\/+/, '')      // Remove leading slashes
                .replace(/^\.\//, '');    // Remove leading ./

            if (!cleanPath) return;

            // 2. Content Handling (Text vs Binary)
            if (isBase64Data(file.content)) {
                // Extract the pure Base64 string (remove data:image/png;base64, prefix)
                const base64Data = file.content.split(';base64,').pop();
                if (base64Data) {
                    zip.file(cleanPath, base64Data, { base64: true });
                }
            } else {
                // Standard Text File
                zip.file(cleanPath, file.content);
            }
        });

        // 3. Generate and Trigger Download
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}-${new Date().getTime()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
