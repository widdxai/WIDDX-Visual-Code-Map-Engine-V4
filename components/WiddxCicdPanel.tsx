
import React from 'react';
import { Terminal, Download, FileJson, AlertTriangle, CheckCircle, Share2, Workflow, Command, Shield, TestTube } from 'lucide-react';
import { WiddxGraph } from '../types';
import { getCliScriptContent } from '../services/widdxCliGenerator';
import { getPlaywrightConfig, getBasicSpec, getE2EReadme } from '../services/playwrightGenerator';
import JSZip from 'jszip';

interface WiddxCicdPanelProps {
    graph: WiddxGraph | null;
}

export const WiddxCicdPanel: React.FC<WiddxCicdPanelProps> = ({ graph }) => {
    
    const downloadCliScript = () => {
        const script = getCliScriptContent();
        const blob = new Blob([script], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'widdx-cli.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportJsonReport = () => {
        if (!graph) return;
        const report = { timestamp: new Date().toISOString(), meta: graph.widdxMeta, metrics: { files: graph.nodes.length, edges: graph.edges.length }, issues: [...graph.errors, ...graph.warnings] };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'widdx-report.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadPlaywrightSuite = async () => {
        try {
            const zip = new JSZip();
            zip.file('playwright.config.ts', getPlaywrightConfig());
            const tests = zip.folder("tests");
            if (tests) {
                tests.file('example.spec.ts', getBasicSpec());
            }
            zip.file('README-e2e.md', getE2EReadme());
            
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'widdx-playwright-kit.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Failed to generate Playwright zip", e);
            alert("Failed to generate Playwright suite.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0b0e14] text-slate-200">
            <div className="px-4 py-3 border-b border-slate-800 bg-[#161b22]/50 backdrop-blur-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Workflow size={14} className="text-blue-500" /> Pipeline Integration
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* CLI Section */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Terminal size={14} /> Headless Execution</label>
                    <div className="bg-[#0f1219] border border-slate-800 rounded-xl p-1 relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                        <div className="p-4 font-mono text-xs space-y-2">
                            <div className="text-slate-500"># Run analysis in CI/CD (GitHub Actions)</div>
                            <div className="flex items-center gap-2 text-emerald-400">
                                <span className="text-purple-400">$</span> node widdx-cli.js --target=./src --report=json
                            </div>
                        </div>
                        <button onClick={downloadCliScript} className="w-full py-2 bg-[#1e293b] hover:bg-blue-600 text-slate-300 hover:text-white text-xs font-bold transition-all border-t border-slate-800 flex items-center justify-center gap-2">
                            <Download size={14} /> Download Script
                        </button>
                    </div>
                </div>

                {/* Test Generation Section (Playwright) */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><TestTube size={14} /> End-to-End Testing</label>
                    <div className="bg-[#0f1219] border border-slate-800 rounded-xl p-1 relative overflow-hidden shadow-2xl group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
                        <div className="p-4 font-mono text-xs space-y-2">
                            <div className="text-slate-500"># Run Playwright E2E Tests</div>
                            <div className="flex items-center gap-2 text-orange-400">
                                <span className="text-slate-600">$</span> npx playwright test
                            </div>
                        </div>
                        <button onClick={downloadPlaywrightSuite} className="w-full py-2 bg-[#1e293b] hover:bg-orange-900/30 text-slate-300 hover:text-orange-400 text-xs font-bold transition-all border-t border-slate-800 flex items-center justify-center gap-2">
                            <Shield size={14} /> Generate Playwright Suite
                        </button>
                    </div>
                </div>

                {/* Report Section */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileJson size={14} /> Artifact Generation</label>
                    <div className="bg-[#161b22] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between gap-4 group hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${graph?.errors.length ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
                                {graph?.errors.length ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-200">System Audit Report</div>
                                <div className="text-[10px] text-slate-500">Includes full dependency graph & error logs</div>
                            </div>
                        </div>
                        <button onClick={exportJsonReport} disabled={!graph} className="p-3 bg-slate-800 rounded-lg hover:bg-blue-600 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
                            <Share2 size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
