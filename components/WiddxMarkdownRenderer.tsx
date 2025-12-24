
import React, { useState } from 'react';
import { Check, Copy, Brain, ChevronDown, ChevronRight, MousePointerClick, ExternalLink, Quote, Hash } from 'lucide-react';

interface WiddxMarkdownRendererProps {
    content: string;
    role: string;
    defaultThinkingExpanded: boolean;
    validFilePaths: Set<string>;
    onLinkClick: (path: string) => void;
}

const getTextDirection = (text: string): 'rtl' | 'ltr' => {
    const rtlPattern = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    const sample = text.slice(0, 100);
    return rtlPattern.test(sample) ? 'rtl' : 'ltr';
};

// Helper to linkify file paths, external links, and process inline markdown
const renderInlineMarkdown = (text: string, validFilePaths: Set<string>, onLinkClick: (path: string) => void) => {
    // 1. Split by Bold (**text**)
    const boldParts = text.split(/(\*\*.*?\*\*)/g);
    
    return boldParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        
        // 2. Split by Inline Code (`text`)
        const codeParts = part.split(/(`[^`]+`)/g);
        return codeParts.map((subPart, j) => {
            if (subPart.startsWith('`') && subPart.endsWith('`')) {
                return <code key={`${i}-${j}`} className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[11px] font-mono text-purple-300 mx-0.5 shadow-sm">{subPart.slice(1, -1)}</code>;
            }

            // 3. Process Links [text](url) - Basic Regex
            const linkParts = subPart.split(/(\[[^\]]+\]\([^)]+\))/g);
            return linkParts.map((token, k) => {
                const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (linkMatch) {
                    const label = linkMatch[1];
                    const url = linkMatch[2];
                    return (
                        <a key={`${i}-${j}-${k}`} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 underline-offset-4 inline-flex items-center gap-1">
                            {label} <ExternalLink size={10} />
                        </a>
                    );
                }

                // 4. Process Cinematic Graph Links (File Paths)
                if (!validFilePaths || validFilePaths.size === 0) return token;
                
                // Split by whitespace to find potential file paths
                const words = token.split(/(\s+|['"(),:;])/g);
                
                return words.map((word, l) => {
                    const cleanWord = word.replace(/^['"`(]+|['"`).,:]+$/g, '');
                    const candidates = [cleanWord, '/' + cleanWord, cleanWord.replace(/^\.\//, '/')];
                    const match = candidates.find(c => validFilePaths.has(c));

                    // Heuristic: Must have dot (ext) and be reasonably long to avoid false positives like "a.b"
                    if (match && cleanWord.includes('.') && cleanWord.length > 3) {
                        return (
                            <span 
                                key={`${i}-${j}-${k}-${l}`} 
                                onClick={() => onLinkClick(match)}
                                className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 cursor-pointer border border-purple-500/20 hover:border-purple-500/40 transition-all font-mono text-[11px] group select-none align-middle"
                                title="Reveal in Graph"
                            >
                                <MousePointerClick size={10} className="opacity-50 group-hover:opacity-100" />
                                {cleanWord}
                            </span>
                        );
                    }
                    return word;
                });
            });
        });
    });
};

export const WiddxMarkdownRenderer: React.FC<WiddxMarkdownRendererProps> = ({ 
    content, role, defaultThinkingExpanded, validFilePaths, onLinkClick 
}) => {
    
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    let thoughtContent = null;
    let cleanContent = content;

    if (thinkMatch) {
        thoughtContent = thinkMatch[1].trim();
        cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    }

    const shouldExpand = defaultThinkingExpanded || (thoughtContent && thoughtContent.length < 150) || !cleanContent;
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(shouldExpand);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const parts = cleanContent.split(/(```[\s\S]*?```)/g);
    const mainDir = getTextDirection(cleanContent);

    const handleCopy = (code: string, index: number) => {
        navigator.clipboard.writeText(code);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className={`text-[13px] leading-7 break-words ${role === 'user' ? 'text-white' : 'text-zinc-300'} ${mainDir === 'rtl' ? 'font-tajawal' : 'font-sans'}`}>
            
            {/* Thinking Block */}
            {thoughtContent && (
                <div className="mb-4 rounded-lg bg-[#000000]/30 border border-white/10 overflow-hidden max-w-full group transition-all" dir="ltr">
                    <div 
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/5 transition-colors bg-gradient-to-r from-purple-900/10 to-transparent"
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                    >
                        <Brain size={12} className={`text-purple-400 ${isThinkingExpanded ? 'text-purple-300' : ''}`} />
                        <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-400 uppercase tracking-widest flex-1">
                            Reasoning Process
                        </span>
                        <div className="ml-auto">
                            {isThinkingExpanded ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-600" />}
                        </div>
                    </div>
                    
                    {isThinkingExpanded && (
                        <div className="p-3 border-t border-white/5 bg-[#0a0a0a]/50 animate-fade-in relative">
                            {/* Decorative line */}
                            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-purple-500/20 rounded-full"></div>
                            <div className="pl-3 font-mono text-[11px] text-zinc-400/90 leading-relaxed whitespace-pre-wrap">
                                {thoughtContent}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Loop */}
            {parts.map((part, index) => {
                // CODE BLOCK
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w*)\n([\s\S]*?)```/);
                    const lang = match ? match[1] : '';
                    const code = match ? match[2] : part.replace(/```/g, '');
                    
                    return (
                        <div key={index} className="my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0c0c0e] shadow-lg group relative max-w-full w-full" dir="ltr">
                            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
                                <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase flex items-center gap-2">
                                    <Hash size={10} className="opacity-50"/> {lang || 'CODE'}
                                </span>
                                <button 
                                    onClick={() => handleCopy(code, index)}
                                    className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5"
                                    title="Copy Code"
                                >
                                    {copiedIndex === index ? (
                                        <><Check size={12} className="text-emerald-400" /><span className="text-[9px] text-emerald-400 font-bold">COPIED</span></>
                                    ) : (
                                        <><Copy size={12} /><span className="text-[9px]">COPY</span></>
                                    )}
                                </button>
                            </div>
                            <pre className="p-4 overflow-x-auto custom-scrollbar font-mono-tight text-[12px] text-zinc-300 leading-relaxed bg-[#09090b]">
                                <code>{code}</code>
                            </pre>
                        </div>
                    );
                } 
                // TEXT BLOCK (Markdown Parsing)
                else {
                    const lines = part.split('\n');
                    const renderedLines: React.ReactNode[] = [];
                    let listStack: React.ReactNode[] = [];
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const trimLine = line.trim();
                        
                        if (!trimLine) {
                            if (listStack.length > 0) {
                                renderedLines.push(<ul key={`list-${i}`} className="list-none space-y-2 my-3">{listStack}</ul>);
                                listStack = [];
                            }
                            // Only add spacing if not the very last line
                            if (i < lines.length - 1) renderedLines.push(<div key={i} className="h-2" />);
                            continue;
                        }

                        // --- Headers ---
                        if (trimLine.startsWith('### ')) {
                            renderedLines.push(
                                <h3 key={i} className="text-sm font-bold text-purple-200 mt-5 mb-2 flex items-center gap-2">
                                    {renderInlineMarkdown(trimLine.replace('### ', ''), validFilePaths, onLinkClick)}
                                </h3>
                            );
                        } else if (trimLine.startsWith('## ')) {
                            renderedLines.push(
                                <h2 key={i} className="text-base font-bold text-white mt-6 mb-3 border-b border-white/10 pb-2">
                                    {renderInlineMarkdown(trimLine.replace('## ', ''), validFilePaths, onLinkClick)}
                                </h2>
                            );
                        } 
                        // --- Horizontal Rule ---
                        else if (trimLine === '---' || trimLine === '***') {
                            renderedLines.push(<hr key={i} className="my-6 border-white/10" />);
                        }
                        // --- Blockquotes ---
                        else if (trimLine.startsWith('> ')) {
                            renderedLines.push(
                                <div key={i} className="flex gap-3 pl-2 my-3 relative">
                                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-purple-500/40 rounded-full"></div>
                                    <div className="pl-4 text-zinc-400 italic text-[12px]">
                                        {renderInlineMarkdown(trimLine.replace(/^>\s*/, ''), validFilePaths, onLinkClick)}
                                    </div>
                                </div>
                            );
                        }
                        // --- List Items ---
                        else if (trimLine.startsWith('- ') || trimLine.startsWith('* ')) {
                            listStack.push(
                                <li key={i} className="flex items-start gap-2 text-zinc-300 pl-1">
                                    <span className="mt-2 w-1 h-1 rounded-full bg-zinc-500 shrink-0 opacity-70"></span>
                                    <span className="leading-6">{renderInlineMarkdown(trimLine.replace(/^[-*]\s/, ''), validFilePaths, onLinkClick)}</span>
                                </li>
                            );
                        }
                        // --- Numbered Lists ---
                        else if (trimLine.match(/^\d+\.\s/)) {
                             const num = trimLine.split('.')[0];
                             listStack.push(
                                <li key={i} className="flex items-start gap-2 text-zinc-300 pl-1">
                                    <span className="font-mono text-zinc-500 text-[10px] mt-1 shrink-0 select-none">{num}.</span>
                                    <span className="leading-6">{renderInlineMarkdown(trimLine.replace(/^\d+\.\s/, ''), validFilePaths, onLinkClick)}</span>
                                </li>
                            );
                        }
                        // --- Standard Paragraph ---
                        else {
                            if (listStack.length > 0) {
                                renderedLines.push(<ul key={`list-${i}`} className="list-none space-y-2 my-3 pl-1">{listStack}</ul>);
                                listStack = [];
                            }
                            renderedLines.push(
                                <div key={i} dir={getTextDirection(trimLine)} className="min-h-[1.5em] my-1 leading-6">
                                    {renderInlineMarkdown(line, validFilePaths, onLinkClick)}
                                </div>
                            );
                        }
                    }
                    // Flush remaining list
                    if (listStack.length > 0) {
                        renderedLines.push(<ul key={`list-end`} className="list-none space-y-2 my-3 pl-1">{listStack}</ul>);
                    }

                    return <div key={index}>{renderedLines}</div>;
                }
            })}
        </div>
    );
};
