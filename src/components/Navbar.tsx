import React from 'react';
import { Camera, Database, Code, Download, Settings, Sparkles, BookOpen, ExternalLink } from 'lucide-react';

interface NavbarProps {
  noteCount: number;
  onOpenSqlConsole: () => void;
  onOpenJavaCompanion: () => void;
  onOpenSettings: () => void;
  onBatchExportPdf: () => void;
  activeTab: 'scanner' | 'database';
  setActiveTab: (tab: 'scanner' | 'database') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  noteCount,
  onOpenSqlConsole,
  onOpenJavaCompanion,
  onOpenSettings,
  onBatchExportPdf,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                HandROI <span className="text-cyan-400 font-mono text-sm px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">CV+OCR</span>
              </h1>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                by Mitakshara
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Real-time CV Gesture Scanner • Adaptive OCR • SQLite DB
            </p>
          </div>
        </div>

        {/* Center View Mode Switcher */}
        <div className="flex items-center p-1 bg-slate-800/80 rounded-lg border border-slate-700/60">
          <button
            id="nav-tab-scanner"
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'scanner'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>CV Scanner & ROI</span>
          </button>
          <button
            id="nav-tab-database"
            onClick={() => setActiveTab('database')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'database'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQLite Notes DB</span>
            <span className="ml-1 px-1.5 py-0.2 bg-slate-900/60 rounded text-[10px] text-cyan-300">
              {noteCount}
            </span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center space-x-2">
          {/* SQL Console Button */}
          <button
            id="btn-open-sql-console"
            onClick={onOpenSqlConsole}
            title="Execute raw SQL queries against SQLite database"
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-mono transition border border-slate-700"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQL Console</span>
          </button>

          {/* Java 17 Source Hub */}
          <button
            id="btn-open-java-hub"
            onClick={onOpenJavaCompanion}
            title="View Java 17 / OpenCV JavaCV / Tess4J / JavaFX Source Files"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 hover:text-cyan-200 rounded-lg text-xs font-medium transition border border-cyan-800/80"
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Java 17+ Codebase</span>
            <span className="sm:hidden">Java</span>
          </button>

          {/* Batch Export PDF */}
          <button
            id="btn-batch-export-pdf"
            onClick={onBatchExportPdf}
            title="Export all digitized notes to PDF document"
            className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition border border-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export All</span>
          </button>

          {/* Open in Standalone Window Button */}
          <button
            id="btn-open-standalone"
            onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
            title="Open in Standalone Browser Window (Grants direct laptop webcam permissions)"
            className="p-2 text-slate-400 hover:text-cyan-300 bg-slate-800/60 hover:bg-slate-700 rounded-lg transition border border-slate-700/60"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Settings Modal Toggle */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            title="CV & OCR Parameters"
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-lg transition border border-slate-700/60"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
