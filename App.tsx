
import React, { useState, useEffect, useCallback } from 'react';
import { WiddxIngestion } from './components/WiddxIngestion';
import { WiddxVisualizer } from './components/WiddxVisualizer';
import { WiddxSidebar } from './components/WiddxSidebar';
import { WiddxEditorPanel } from './components/WiddxEditorPanel'; 
import { WiddxMissingImportsPanel } from './components/WiddxMissingImportsPanel';
import { WiddxSettingsModal } from './components/WiddxSettingsModal';
import { WiddxGuideModal } from './components/WiddxGuideModal'; 
import { WiddxCommandPalette } from './components/WiddxCommandPalette';
import { WiddxChatPanel } from './components/WiddxChatPanel';
import { WiddxPreviewPanel } from './components/WiddxPreviewPanel';
import { StorageService, DEFAULT_EDITOR_CONFIG, EditorConfig } from './services/storageService';
import { WiddxNodeType } from './types';
import { Globe, Code, Network, Zap, Play, Download, Loader2, PanelRight, Layout } from 'lucide-react'; 
import { Language } from './services/i18n';
import { WiddxLogo } from './components/WiddxLogo'; 
import { useProjectManager } from './hooks/useProjectManager'; 

const App: React.FC = () => {
  const {
      files, graph, selectedNodeId, openFiles, aiProcessingNodeId, isFixing, isRestoring,
      setAiProcessingNodeId, handleIngest, handleResetProject, handleUpdateFile,
      handleDeleteFile, handleCreateFile, handleRenameFile, handleFixFile,
      handleFixAll, handleNodeSelect, handleCloseFile, handleExportZip, analyze,
      protocolOverrides, updateProtocols, projectId
  } = useProjectManager();

  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false); 
  const [lang, setLang] = useState<Language>('en');
  const [mainView, setMainView] = useState<'graph' | 'editor' | 'preview'>('graph'); 
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(400);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [editorConfig, setEditorConfig] = useState<EditorConfig>(DEFAULT_EDITOR_CONFIG);
  const [editorLine, setEditorLine] = useState<number | undefined>(undefined);

  // Initialize Settings
  useEffect(() => {
    const initApp = async () => {
        const settings = await StorageService.loadSettings();
        if (settings.editor) setEditorConfig(settings.editor);
    };
    initApp();
  }, []);

  // Update view automatically if a file is selected
  useEffect(() => {
      const node = graph?.nodes.find(n => n.id === selectedNodeId);
      if (node?.type === WiddxNodeType.FILE && mainView !== 'editor') {
          setMainView('editor');
      }
  }, [selectedNodeId, graph]);

  // Chat Panel Resizing Logic
  const startResizingChat = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingChat(true);
  }, []);

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isResizingChat) return;
          let newWidth;
          if (lang === 'ar') {
              newWidth = e.clientX;
          } else {
              newWidth = window.innerWidth - e.clientX;
          }
          if (newWidth < 300) newWidth = 300;
          if (newWidth > 800) newWidth = 800;
          setChatPanelWidth(newWidth);
      };
      const handleMouseUp = () => setIsResizingChat(false);

      if (isResizingChat) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
      } else {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizingChat, lang]);

  const handleManualAudit = useCallback(() => {
      if (files.length > 0) analyze(files);
  }, [files, analyze]);

  const handleSymbolSelect = useCallback((fileId: string, line: number) => {
      handleNodeSelect(fileId);
      setTimeout(() => setEditorLine(line), 50);
      setMainView('editor');
  }, [handleNodeSelect]);

  const handleStandardNodeSelect = useCallback((id: string) => {
      handleNodeSelect(id);
      setEditorLine(undefined); 
  }, [handleNodeSelect]);

  const selectedNode = graph?.nodes.find(n => n.id === selectedNodeId);

  if (isRestoring) {
      return (
          <div className="h-screen w-screen bg-[#121212] flex flex-col items-center justify-center text-zinc-400">
              <div className="relative">
                  <div className="w-16 h-16 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-purple-500 rounded-full opacity-20 animate-pulse"></div>
                  </div>
              </div>
              <p className="mt-6 text-sm font-mono tracking-widest uppercase text-zinc-500">Initializing Core...</p>
          </div>
      );
  }

  return (
     <div className="h-screen w-screen bg-[#121212] text-zinc-200 flex flex-col font-sans overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <WiddxCommandPalette 
            files={files}
            onSelectFile={handleStandardNodeSelect}
            lang={lang}
            actions={{
                onReset: handleResetProject,
                onExport: handleExportZip,
                onToggleSettings: () => setShowSettings(true),
                onToggleLang: () => setLang(l => l === 'en' ? 'ar' : 'en')
            }}
        />

        {!graph ? (
           <div className="flex-1 relative">
              <div className="absolute top-6 right-6 z-50 flex gap-2">
                 <button onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')} className="p-2.5 bg-zinc-800/80 backdrop-blur-md rounded-xl hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 shadow-lg transition-all">
                    <Globe size={18} />
                 </button>
              </div>
              <WiddxIngestion onIngest={handleIngest} lang={lang} />
           </div>
        ) : (
           <>
              {/* --- APP HEADER --- */}
              <header className="h-14 bg-[#18181b]/95 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between px-4 shrink-0 relative z-50 shadow-md">
                   <div className="flex items-center gap-4">
                      <div className="opacity-90 hover:opacity-100 transition-opacity cursor-pointer" title="WIDDX V4">
                          <WiddxLogo className="h-6 w-auto" />
                      </div>
                   </div>

                   {/* Central View Switcher (Segmented Control) */}
                   <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
                      <div className="flex items-center bg-[#27272a] p-1 rounded-xl border border-zinc-700 shadow-inner">
                          {(['graph', 'editor', 'preview'] as const).map((view) => {
                              const isActive = mainView === view;
                              const Icon = view === 'graph' ? Network : view === 'editor' ? Code : Play;
                              const label = view === 'graph' ? (lang === 'ar' ? 'المخطط' : 'Graph') 
                                          : view === 'editor' ? (lang === 'ar' ? 'المحرر' : 'Editor')
                                          : (lang === 'ar' ? 'معاينة' : 'Run');
                              
                              return (
                                  <button
                                      key={view}
                                      onClick={() => setMainView(view)}
                                      className={`
                                          flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200
                                          ${isActive 
                                              ? 'bg-[#18181b] text-white shadow-sm ring-1 ring-white/5' 
                                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                                      `}
                                  >
                                      <Icon size={14} className={isActive ? (view === 'editor' ? 'text-purple-400' : view === 'preview' ? 'text-amber-400' : 'text-blue-400') : ''} />
                                      <span>{label}</span>
                                  </button>
                              );
                          })}
                      </div>
                   </div>

                   {/* Right Controls */}
                   <div className="flex items-center gap-2">
                       <button onClick={handleExportZip} className="p-2 rounded-lg text-zinc-500 hover:text-purple-400 hover:bg-zinc-800 transition-colors" title={lang === 'ar' ? "تصدير" : "Export"}>
                            <Download size={18} strokeWidth={1.8} />
                       </button>
                       <div className="h-4 w-px bg-zinc-800/80 mx-1"></div>
                       <button 
                            onClick={() => setShowChatPanel(!showChatPanel)} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${showChatPanel ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-[#27272a] border-zinc-700 text-zinc-400 hover:text-white'}`}
                        >
                            <Zap size={16} fill={showChatPanel ? "currentColor" : "none"} />
                            <span className="text-xs font-bold hidden md:inline">{lang === 'ar' ? "المساعد" : "Assistant"}</span>
                       </button>
                   </div>
              </header>

              <div className="flex-1 flex overflow-hidden relative">
                  <WiddxSidebar 
                     data={graph} 
                     selectedNodeId={selectedNodeId} 
                     onSelectNode={handleStandardNodeSelect}
                     onUpdateFile={handleUpdateFile}
                     onDeleteFile={handleDeleteFile}
                     onCreateFile={handleCreateFile}
                     onRenameFile={handleRenameFile}
                     onReset={handleResetProject}
                     onExport={handleExportZip} 
                     lang={lang}
                     onToggleLang={() => setLang(l => l === 'en' ? 'ar' : 'en')}
                     onToggleSettings={() => setShowSettings(true)}
                     onToggleGuide={() => setShowGuide(true)}
                     aiProcessingNodeId={aiProcessingNodeId}
                     onAiProcessing={setAiProcessingNodeId}
                     onRunAudit={handleManualAudit}
                     onSelectSymbol={handleSymbolSelect}
                  />
                  
                  <div className="flex-1 flex min-w-0 relative">
                      <div className="flex-1 flex flex-col min-w-0 relative bg-[#121212]">
                          {/* Main Workspace (Graph/Editor/Preview) */}
                          <div className="flex-1 relative overflow-hidden"> 
                              <div className={`absolute inset-0 ${mainView === 'graph' ? 'z-10 visible opacity-100' : 'z-0 invisible opacity-0 pointer-events-none'} transition-opacity duration-300`}>
                                 <WiddxVisualizer data={graph} projectId={projectId} onNodeSelect={handleStandardNodeSelect} isActive={mainView === 'graph'} />
                              </div>
                              <div className={`absolute inset-0 bg-[#121212] ${mainView === 'editor' ? 'z-20 visible opacity-100' : 'z-0 invisible opacity-0 pointer-events-none'} transition-opacity duration-300`}>
                                 <WiddxEditorPanel 
                                    selectedNodeId={selectedNodeId}
                                    openFiles={openFiles}
                                    onCloseFile={handleCloseFile}
                                    onSelectFile={handleStandardNodeSelect}
                                    initialContent={selectedNode?.content}
                                    fileName={selectedNode?.name}
                                    files={files} 
                                    onUpdateFile={handleUpdateFile}
                                    onDeleteFile={handleDeleteFile}
                                    onRevealInGraph={() => setMainView('graph')}
                                    lang={lang}
                                    editorSettings={editorConfig}
                                    revealLine={editorLine}
                                 />
                              </div>
                              <div className={`absolute inset-0 bg-[#121212] ${mainView === 'preview' ? 'z-30 visible opacity-100' : 'z-0 invisible opacity-0 pointer-events-none'} transition-opacity duration-300`}>
                                 <WiddxPreviewPanel files={files} graph={graph} />
                              </div>
                          </div>
                      </div>

                      {showChatPanel && (
                          <>
                            <div onMouseDown={startResizingChat} className={`w-1 h-full cursor-col-resize z-50 transition-colors hover:bg-purple-500/50 ${isResizingChat ? 'bg-purple-600' : 'bg-zinc-800/30'}`} />
                            <div style={{ width: chatPanelWidth }} className={`border-l border-zinc-800 bg-[#18181b] flex flex-col shadow-2xl z-40 shrink-0 ${isResizingChat ? '' : 'transition-[width] duration-300 ease-out'}`}>
                               <WiddxChatPanel 
                                    selectedNodeId={selectedNodeId}
                                    totalFiles={graph.nodes.length}
                                    graph={graph}
                                    onCreateFile={handleCreateFile}
                                    onUpdateFile={handleUpdateFile}
                                    onDeleteFile={handleDeleteFile}
                                    onRenameFile={handleRenameFile}
                                    onSelectNode={handleStandardNodeSelect}
                                    lang={lang}
                                    onAiProcessing={setAiProcessingNodeId}
                                    onClose={() => setShowChatPanel(false)}
                                    projectId={projectId}
                                />
                            </div>
                          </>
                      )}
                  </div>
              </div>
              
              {/* --- FOOTER STATUS PANEL (FULL WIDTH) --- */}
              <WiddxMissingImportsPanel 
                  graph={graph} 
                  onFixFile={handleFixFile}
                  onFixAll={handleFixAll} 
                  onDeleteFile={handleDeleteFile}
                  onSelectNode={handleStandardNodeSelect}
                  isFixing={isFixing}
                  lang={lang}
                  selectedNodeId={selectedNodeId}
              />
              
              <WiddxSettingsModal 
                  isOpen={showSettings} 
                  onClose={() => setShowSettings(false)} 
                  lang={lang} 
                  onConfigUpdate={setEditorConfig}
                  currentProtocols={graph.widdxMeta.protocols}
                  onUpdateProtocols={updateProtocols}
              />
              <WiddxGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} lang={lang} />
           </>
        )}
     </div>
  );
};

export default App;
