
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle, ExternalLink, Play, Terminal } from 'lucide-react';
import { WiddxFileEntry, WiddxGraph } from '../types';

interface WiddxPreviewPanelProps {
    files: WiddxFileEntry[];
    graph: WiddxGraph | null;
}

export const WiddxPreviewPanel: React.FC<WiddxPreviewPanelProps> = ({ files, graph }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<{level: string, message: string}[]>([]);
    const [buildError, setBuildError] = useState<string | null>(null);

    const generateBundle = async () => {
        setIsLoading(true);
        setLogs([]);
        setBuildError(null);

        try {
            // 1. Determine Entry Point
            let entryHtml = files.find(f => f.path.endsWith('index.html'))?.content;
            
            // Fallback Entry HTML for React/JS Projects lacking explicit index.html
            if (!entryHtml) {
                entryHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WIDDX Preview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #333; margin: 0; padding: 0; }
        #root { padding: 20px; }
        .error-box { background: #fee2e2; color: #b91c1c; padding: 15px; border-radius: 8px; margin: 20px; border: 1px solid #fca5a5; font-family: monospace; }
    </style>
</head>
<body>
    <div id="root"></div>
    <!-- WIDDX Bootstrapper -->
    <script type="text/babel" data-type="module" data-presets="react,typescript">
        // Using data-type="module" tells Babel to compile this as a module (preserving imports)
        // Removed 'env' preset to prevent transformation to CommonJS 'require' calls
        import App from './src/App'; 
        import { createRoot } from 'react-dom/client';
        
        try {
            const container = document.getElementById('root');
            const root = createRoot(container);
            
            if (typeof App === 'function' || (typeof App === 'object' && App !== null)) {
                // Determine if it's a React Component or a legacy object
                // Check if it looks like a React component (function or class)
                // or if it has a render method/init method (Demo object style)
                if (App.init) {
                    App.init(); // Legacy/Demo mode
                } else {
                    root.render(<App />); // React Component mode
                }
            } else {
                console.warn("App entry invalid. Exported:", App);
                container.innerHTML = '<div class="error-box"><strong>Setup Error:</strong> App entry point did not export a valid Component or Object.</div>';
            }
        } catch (e) {
            console.error("Bootstrap Error:", e);
            document.getElementById('root').innerHTML = '<div class="error-box"><strong>Runtime Error:</strong><br/>' + e.message + '</div>';
        }
    </script>
</body>
</html>`;
            }

            // 2. Build Import Map & Blob URLs
            const importMap: Record<string, string> = {
                "react": "https://esm.sh/react@18.2.0",
                "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
                "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime",
                "lucide-react": "https://esm.sh/lucide-react@0.263.1",
                "clsx": "https://esm.sh/clsx",
                "tailwind-merge": "https://esm.sh/tailwind-merge"
            };

            const createBlobUrl = (content: string, type: string) => {
                return URL.createObjectURL(new Blob([content], { type }));
            };

            const cssContent: string[] = [];

            // Sort files to handle processing
            for (const file of files) {
                // Normalize path (ensure starts with ./)
                const relPath = file.path.startsWith('/') ? '.' + file.path : './' + file.path;
                
                // Handle CSS separately (inject into head)
                if (file.path.endsWith('.css')) {
                    cssContent.push(file.content);
                    continue; 
                }

                // Treat JS/TS/JSON as modules
                let content = file.content;
                let mimeType = 'text/javascript';

                if (file.path.endsWith('.json')) {
                    content = `export default ${content};`;
                }

                const blobUrl = createBlobUrl(content, mimeType);
                
                // Map exact path
                importMap[relPath] = blobUrl;
                
                // Map without extension (for clean imports like './App')
                const noExt = relPath.replace(/\.(tsx|ts|jsx|js|json)$/, '');
                if (noExt !== relPath) {
                    importMap[noExt] = blobUrl;
                }
                
                // Also map "/src/App" style (absolute-ish) if needed
                if (file.path.startsWith('src/')) {
                     importMap['./' + file.path] = blobUrl;
                }
            }

            // 3. Construct Final HTML with Security hardening
            const cspHeader = `<meta http-equiv="Content-Security-Policy" content="
                default-src 'self' blob: data:;
                script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://esm.sh https://unpkg.com;
                style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
                font-src 'self' data: https://fonts.gstatic.com;
                connect-src 'self' blob: data: https://esm.sh;
                img-src 'self' blob: data: https://images.unsplash.com;
            ">`;

            const importMapScript = `<script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>`;
            // Use specific version of babel-standalone if needed, but latest is usually fine
            // Added crossorigin="anonymous" to fix "Script error." opacity
            const babelScript = `<script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin="anonymous"></script>`;
            const styles = `<style>${cssContent.join('\n')}</style>`;
            
            // Console Interceptor Script
            const interceptorScript = `
                <script>
                    (function() {
                        const send = (level, msg) => window.parent.postMessage({ type: 'PREVIEW_LOG', level, message: String(msg) }, '*');
                        const originalLog = console.log;
                        const originalErr = console.error;
                        const originalWarn = console.warn;
                        
                        console.log = (...args) => { originalLog(...args); send('info', args.join(' ')); };
                        console.error = (...args) => { originalErr(...args); send('error', args.join(' ')); };
                        console.warn = (...args) => { originalWarn(...args); send('warn', args.join(' ')); };
                        
                        window.onerror = (msg, url, line) => {
                            send('error', msg + ' (Line ' + line + ')');
                            return false; 
                        };
                    })();
                </script>
            `;

            let finalHtml = entryHtml
                .replace('<head>', `<head>${cspHeader}${interceptorScript}${importMapScript}${babelScript}${styles}`)
                // CRITICAL FIX: Add data-type="module" and remove "env" preset to keep imports as ESM
                .replace(/type="module"/g, 'type="text/babel" data-type="module" data-presets="react,typescript"');

            if (iframeRef.current) {
                iframeRef.current.srcdoc = finalHtml;
            }

            setTimeout(() => setIsLoading(false), 600);

        } catch (e: any) {
            console.error(e);
            setBuildError(e.message);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        generateBundle();

        const msgHandler = (e: MessageEvent) => {
            if (e.data?.type === 'PREVIEW_LOG') {
                setLogs(prev => [...prev.slice(-99), { level: e.data.level, message: e.data.message }]);
            }
        };
        window.addEventListener('message', msgHandler);
        return () => window.removeEventListener('message', msgHandler);
    }, [files]);

    return (
        <div className="flex flex-col h-full bg-[#0b0e14]">
            {/* Toolbar */}
            <div className="h-10 border-b border-slate-800 bg-[#161b22] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Play size={14} className="text-emerald-400" />
                    <span>Live Preview</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-500 font-mono">localhost:3000</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={generateBundle} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="Reload Frame">
                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="Open External">
                        <ExternalLink size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative bg-white overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 z-10 bg-[#0b0e14]/90 flex flex-col items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                        <span className="text-xs font-bold text-slate-400 tracking-widest">BUNDLING ASSETS...</span>
                    </div>
                )}
                
                {buildError ? (
                    <div className="absolute inset-0 z-0 bg-[#0b0e14] flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-red-400 mb-2">Build Failed</h3>
                        <p className="text-xs text-slate-500 font-mono bg-black/50 p-3 rounded max-w-lg border border-red-900/30">
                            {buildError}
                        </p>
                        <button onClick={generateBundle} className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded">
                            Retry Build
                        </button>
                    </div>
                ) : (
                    <iframe 
                        ref={iframeRef}
                        className="w-full h-full border-none bg-white"
                        title="Widdx Preview"
                        sandbox="allow-scripts allow-same-origin allow-modals allow-popups allow-forms"
                    />
                )}
            </div>

            {/* Console Output */}
            <div className="h-36 bg-[#09090b] border-t border-slate-800 flex flex-col shrink-0">
                <div className="px-3 py-1 bg-[#161b22] border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center">
                    <span className="flex items-center gap-2"><Terminal size={12} /> Console Output</span>
                    <button onClick={() => setLogs([])} className="hover:text-white">Clear</button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-[10px] space-y-1">
                    {logs.length === 0 ? (
                        <span className="text-slate-700 italic px-2">Ready. Output will appear here.</span>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className={`break-all px-2 py-0.5 border-l-2 ${
                                log.level === 'error' ? 'border-red-500 text-red-300 bg-red-900/10' : 
                                log.level === 'warn' ? 'border-amber-500 text-amber-300 bg-amber-900/10' : 
                                'border-slate-700 text-slate-400'
                            }`}>
                                <span className="opacity-50 mr-2 uppercase text-[9px]">{log.level}</span>
                                {log.message}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
