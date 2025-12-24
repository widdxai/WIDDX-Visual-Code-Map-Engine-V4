
import React from 'react';
import { X, Layout, Sidebar, Activity, Terminal, Monitor, HelpCircle, PlayCircle, GitCommit, Search, ShieldCheck } from 'lucide-react';
import { Language, translations } from '../services/i18n';

interface WiddxGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
}

export const WiddxGuideModal: React.FC<WiddxGuideModalProps> = ({ isOpen, onClose, lang }) => {
    if (!isOpen) return null;

    const t = translations[lang];
    const dir = lang === 'ar' ? 'rtl' : 'ltr';

    const workflowSteps = [
        { title: lang === 'ar' ? "1. الرفع والتحليل" : "1. Upload & Analyze", icon: Search, color: "text-blue-400" },
        { title: lang === 'ar' ? "2. البناء المرئي" : "2. Graph Visualization", icon: Layout, color: "text-purple-400" },
        { title: lang === 'ar' ? "3. تفويض المهام" : "3. Intelligent Delegation", icon: Activity, color: "text-emerald-400" },
        { title: lang === 'ar' ? "4. التنفيذ (المعمار)" : "4. Execution (Builders)", icon: Terminal, color: "text-amber-400" },
        { title: lang === 'ar' ? "5. مراجعة الجودة" : "5. QA Review (Sentry)", icon: ShieldCheck, color: "text-red-400" },
        { title: lang === 'ar' ? "6. التصدير" : "6. Export & Deploy", icon: GitCommit, color: "text-slate-400" },
    ];

    const sections = [
        {
            icon: Activity,
            title: t.guide_activity_title,
            desc: t.guide_activity_desc,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10'
        },
        {
            icon: Sidebar,
            title: t.guide_sidebar_title,
            desc: t.guide_sidebar_desc,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10'
        },
        {
            icon: Monitor,
            title: t.guide_workspace_title,
            desc: t.guide_workspace_desc,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10'
        },
        {
            icon: Terminal,
            title: t.guide_repair_title,
            desc: t.guide_repair_desc,
            color: 'text-red-400',
            bg: 'bg-red-500/10'
        },
        {
            icon: Layout,
            title: t.guide_status_title,
            desc: t.guide_status_desc,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10'
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
            <div className="w-[800px] max-w-[95vw] h-[80vh] bg-[#0f1219] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#161b22] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                            <HelpCircle className="text-blue-400" size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-100">{t.ui_guide}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {/* Workflow Section */}
                    <div className="mb-8">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <PlayCircle size={14} /> {lang === 'ar' ? 'سيناريو التشغيل النموذجي' : 'Operational Workflow'}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {workflowSteps.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#161b22] rounded-lg border border-slate-800/50">
                                    <div className={`p-2 rounded-md bg-[#0b0e14] ${step.color}`}>
                                        <step.icon size={16} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-300">{step.title}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 leading-relaxed">
                            {lang === 'ar' 
                                ? "يعتمد النظام على فصل الصلاحيات: Widdx Core للتوجيه، Builders للتنفيذ، و Sentry للمراجعة. يضمن هذا الهيكل جودة الكود ومنع الأخطاء قبل حدوثها."
                                : "The system enforces separation of concerns: Widdx Core directs, Builders execute, and Sentry reviews. This structure ensures code integrity and prevents errors before they occur."
                            }
                        </div>
                    </div>

                    <div className="h-px bg-slate-800 w-full mb-8"></div>

                    {/* UI Guide Section */}
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        {lang === 'ar' ? 'مكونات الواجهة' : 'Interface Components'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sections.map((section, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-slate-800 bg-[#0b0e14] hover:border-slate-600 transition-colors group">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${section.bg} ${section.color} border border-white/5`}>
                                    <section.icon size={20} />
                                </div>
                                <div>
                                    <h3 className={`text-sm font-bold mb-1 ${section.color}`}>{section.title}</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">{section.desc}</p>
                                </div>
                                <div className="text-[10px] font-mono text-slate-600 font-bold opacity-30 group-hover:opacity-100 transition-opacity ml-auto self-center">
                                    0{idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#161b22] border-t border-slate-800 text-center shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all"
                    >
                        {lang === 'ar' ? 'فهمت ذلك، ابدأ' : 'Got it, Let\'s Code'}
                    </button>
                </div>
            </div>
        </div>
    );
};
