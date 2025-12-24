
import React, { useCallback } from 'react';
import { Upload, FolderUp, FileCode, Layers, Cpu, Code2, ArrowRight, Zap, Box } from 'lucide-react';
import { WiddxFileEntry } from '../types';
import { WIDDX_DEMO_FILES } from '../constants';
import { Language, translations } from '../services/i18n';

interface WiddxIngestionProps {
  onIngest: (files: WiddxFileEntry[]) => void;
  lang: Language;
}

export const WiddxIngestion: React.FC<WiddxIngestionProps> = ({ onIngest, lang }) => {
  const t = translations[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const readFileContent = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const isBinary = file.name.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|woff|woff2|ttf|eot|mp3|mp4|webm)$/i);
          const reader = new FileReader();
          
          reader.onload = (event) => {
              if (event.target?.result) {
                  resolve(event.target.result as string);
              } else {
                  resolve("");
              }
          };
          reader.onerror = (err) => reject(err);

          if (isBinary) {
              reader.readAsDataURL(file);
          } else {
              reader.readAsText(file);
          }
      });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList: File[] = Array.from(e.target.files);
      const entries: WiddxFileEntry[] = [];
      
      for (const file of fileList) {
        const relativePath = (file as any).webkitRelativePath || file.name;
        try {
          const content = await readFileContent(file);
          entries.push({ path: relativePath, content: content });
        } catch (err) { 
            console.warn(`Failed to read file ${file.name}`, err); 
        }
      }
      onIngest(entries);
    }
  }, [onIngest]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-12 animate-fade-in relative overflow-hidden bg-[#121212] widdx-engineering-bg" dir={dir}>
      
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[10%] w-[800px] h-[800px] bg-purple-600/5 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] animate-pulse delay-700"></div>
          
          {/* Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] pointer-events-none"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
        
        {/* Brand Header */}
        <div className="mb-14 relative group">
           <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
           <div className="relative flex flex-col items-center">
               <div className="w-24 h-24 bg-[#18181b] border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl mb-6 ring-1 ring-white/5">
                  <Cpu className="text-purple-400 w-12 h-12 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
               </div>
               <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-4 text-white leading-tight">
                 <span className="bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500">WIDDX</span>
                 <span className="text-purple-500">.</span>
                 <span className="text-2xl md:text-3xl font-light text-zinc-400 block mt-2 tracking-widest uppercase">Engine V4</span>
               </h1>
               <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed font-light">
                 Turn your codebase into a living neural network. Visualize architectures, fix broken flows, and engineer with autonomous agents.
               </p>
           </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
          
          {/* Upload Card */}
          <label className="group relative flex flex-col items-center justify-center h-48 bg-[#18181b] border border-zinc-800 rounded-3xl transition-all cursor-pointer hover:bg-[#202024] hover:border-purple-500/30 overflow-hidden">
            <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="animate-scanline opacity-0 group-hover:opacity-50"></div>
            
            <input 
              type="file" 
              multiple 
              {...({ webkitdirectory: "", directory: "" } as any)}
              onChange={handleFileUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            
            <div className="w-16 h-16 rounded-2xl bg-[#27272a] border border-zinc-700 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-purple-500/50 transition-all duration-300 shadow-xl relative z-10">
                <FolderUp className="w-7 h-7 text-purple-400 group-hover:text-purple-300" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center">
                <span className="text-zinc-200 font-bold text-lg tracking-wide">{t.upload_folder}</span>
                <span className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-medium px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-purple-900/50 group-hover:text-purple-400/80 transition-colors">
                    {t.support_ext}
                </span>
            </div>
          </label>

          {/* Demo Card */}
          <button 
            onClick={() => onIngest(WIDDX_DEMO_FILES)}
            className="group relative flex flex-col items-center justify-center h-48 bg-[#18181b] border border-zinc-800 rounded-3xl transition-all cursor-pointer hover:bg-[#202024] hover:border-blue-500/30 overflow-hidden"
          >
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="w-16 h-16 rounded-2xl bg-[#27272a] border border-zinc-700 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-blue-500/50 transition-all duration-300 shadow-xl relative z-10">
                <Box className="w-7 h-7 text-blue-400 group-hover:text-blue-300" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center">
                <span className="text-zinc-200 font-bold text-lg tracking-wide">{t.load_demo}</span>
                <span className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-medium flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-blue-900/50 group-hover:text-blue-400/80 transition-colors">
                    React Ecosystem <ArrowRight size={10} />
                </span>
            </div>
          </button>
        </div>

        {/* Footer Stats */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 opacity-60">
             <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></div>
                FRAMEWORK AGNOSTIC
             </div>
             <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                LOCAL EXECUTION
             </div>
             <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                LIVE EDITING
             </div>
        </div>
      </div>
    </div>
  );
};
