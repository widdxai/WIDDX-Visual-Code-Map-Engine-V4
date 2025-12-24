
import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Check, X, Code, FileDiff } from 'lucide-react';
import { Language, translations } from '../services/i18n';

interface WiddxDiffReviewModalProps {
    path: string;
    originalContent: string;
    newContent: string;
    onApprove: () => void;
    onReject: () => void;
    lang: Language;
}

export const WiddxDiffReviewModal: React.FC<WiddxDiffReviewModalProps> = ({
    path, originalContent, newContent, onApprove, onReject, lang
}) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[90vw] max-w-6xl h-[85vh] bg-[#0b0e14] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161b22]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <FileDiff size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
                                {lang === 'ar' ? 'مراجعة التغييرات المقترحة' : 'Review Proposed Changes'}
                            </h2>
                            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-1">
                                <Code size={12} /> {path}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Monaco Diff Viewer */}
                <div className="flex-1 overflow-hidden bg-[#09090b]">
                     <DiffEditor 
                        height="100%"
                        theme="widdx-dark" // Should inherit theme definition from main app context if loaded
                        original={originalContent}
                        modified={newContent}
                        language="typescript" // Auto-detect based on extension would be ideal, static for diff view is acceptable
                        options={{
                            renderSideBySide: true,
                            readOnly: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        }}
                     />
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-[#161b22] border-t border-slate-800 flex items-center justify-between">
                     <div className="text-[10px] text-slate-500">
                         {lang === 'ar' ? 'يتطلب تعديل الملف موافقة يدوية لضمان سلامة الكود.' : 'File modification requires manual approval to ensure code integrity.'}
                     </div>
                     <div className="flex items-center gap-3">
                         <button 
                            onClick={onReject}
                            className="px-4 py-2 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-slate-700 hover:border-red-500/30"
                         >
                             <X size={14} /> {lang === 'ar' ? 'رفض' : 'Reject'}
                         </button>
                         <button 
                            onClick={onApprove}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                         >
                             <Check size={14} /> {lang === 'ar' ? 'اعتماد التغييرات' : 'Approve Changes'}
                         </button>
                     </div>
                </div>
            </div>
        </div>
    );
};
