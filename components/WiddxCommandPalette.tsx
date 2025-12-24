
import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode, Command, Settings, Download, LogOut, Globe, ArrowRight } from 'lucide-react';
import { WiddxFileEntry } from '../types';
import { Language, translations } from '../services/i18n';

interface WiddxCommandPaletteProps {
    files: WiddxFileEntry[];
    onSelectFile: (path: string) => void;
    actions: {
        onReset: () => void;
        onExport: () => void;
        onToggleSettings: () => void;
        onToggleLang: () => void;
    };
    lang: Language;
}

export const WiddxCommandPalette: React.FC<WiddxCommandPaletteProps> = ({ 
    files, onSelectFile, actions, lang 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const t = translations[lang];

    const COMMANDS = [
        { id: 'cmd-export', label: t.export_zip, icon: Download, action: actions.onExport, group: 'Actions' },
        { id: 'cmd-settings', label: t.settings, icon: Settings, action: actions.onToggleSettings, group: 'Actions' },
        { id: 'cmd-lang', label: lang === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية', icon: Globe, action: actions.onToggleLang, group: 'Actions' },
        { id: 'cmd-reset', label: t.reset, icon: LogOut, action: actions.onReset, group: 'Actions' },
    ];

    // Filter Items
    const filteredFiles = files.filter(f => f.path.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
    const filteredCommands = COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
    
    const allItems = [...filteredCommands, ...filteredFiles];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                setQuery('');
                setSelectedIndex(0);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (index: number) => {
        const item = allItems[index];
        if (!item) return;

        if ('action' in item) {
            item.action();
        } else {
            // It's a file
            onSelectFile(item.path.startsWith('/') ? item.path : '/' + item.path);
        }
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % allItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(selectedIndex);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-[600px] max-w-[90vw] bg-[#0f1219] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-zoom-in ring-1 ring-white/10">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[#161b22]">
                    <Search className="text-slate-500" size={18} />
                    <input 
                        ref={inputRef}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder={lang === 'ar' ? "ابحث عن ملفات أو أوامر..." : "Search files or run commands..."}
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
                    />
                    <div className="flex gap-1">
                        <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400 font-mono">Esc</kbd>
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {allItems.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                            No results found.
                        </div>
                    ) : (
                        allItems.map((item, index) => {
                            const isCommand = 'action' in item;
                            const isSelected = index === selectedIndex;
                            
                            return (
                                <button
                                    key={isCommand ? item.id : item.path}
                                    onClick={() => handleSelect(index)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left ${
                                        isSelected 
                                        ? 'bg-blue-600/10 text-blue-100' 
                                        : 'text-slate-400 hover:bg-slate-800/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isCommand ? (
                                            <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                <item.icon size={14} />
                                            </div>
                                        ) : (
                                            <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800/50 text-slate-500'}`}>
                                                <FileCode size={14} />
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-col min-w-0">
                                            <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : ''}`}>
                                                {isCommand ? item.label : item.path}
                                            </span>
                                            {!isCommand && (
                                                <span className="text-[10px] text-slate-500 font-mono truncate opacity-70">
                                                    File
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {isSelected && <ArrowRight size={14} className="text-blue-400 opacity-50" />}
                                </button>
                            );
                        })
                    )}
                </div>
                
                <div className="px-3 py-1.5 bg-[#161b22] border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-500 select-none">
                     <div className="flex gap-3">
                         <span><strong className="text-slate-400">↑↓</strong> Navigate</span>
                         <span><strong className="text-slate-400">↵</strong> Select</span>
                     </div>
                     <div>
                         <strong className="text-slate-400">WIDDX</strong> Command Palette
                     </div>
                </div>
            </div>
        </div>
    );
};
