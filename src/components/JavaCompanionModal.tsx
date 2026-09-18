import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Download,
  X,
  FileCode,
  Terminal,
  Cpu,
  Layers,
  Database,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { JAVA_PROJECT_FILES, JavaSourceFile } from '../data/javaSourceFiles';

interface JavaCompanionModalProps {
  onClose: () => void;
}

export const JavaCompanionModal: React.FC<JavaCompanionModalProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<JavaSourceFile>(JAVA_PROJECT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = (file: JavaSourceFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllFiles = () => {
    // Downloads all source files sequentially or as a single merged archive text
    JAVA_PROJECT_FILES.forEach((f) => {
      handleDownloadSingleFile(f);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Code className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Java 17+ Architecture &amp; Source Files
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  By Mitakshara • OpenCV • Tess4J • SQLite JDBC
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ready-to-compile source code files corresponding to your desktop Java specification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Architecture Pipeline Banner */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between overflow-x-auto text-xs text-slate-300">
          <div className="flex items-center space-x-3 whitespace-nowrap">
            <span className="text-slate-400 font-semibold">Data Pipeline:</span>
            <span className="px-2 py-1 rounded bg-slate-800 font-mono text-[11px] text-cyan-400 border border-slate-700">
              OpenCV FrameGrabber
            </span>
            <span className="text-slate-600">➔</span>
            <span className="px-2 py-1 rounded bg-slate-800 font-mono text-[11px] text-emerald-400 border border-slate-700">
              Skin Contour &amp; Fingertip ROI
            </span>
            <span className="text-slate-600">➔</span>
            <span className="px-2 py-1 rounded bg-slate-800 font-mono text-[11px] text-amber-400 border border-slate-700">
              Tess4J OCR Engine
            </span>
            <span className="text-slate-600">➔</span>
            <span className="px-2 py-1 rounded bg-slate-800 font-mono text-[11px] text-purple-400 border border-slate-700">
              SQLite JDBC Database
            </span>
            <span className="text-slate-600">➔</span>
            <span className="px-2 py-1 rounded bg-slate-800 font-mono text-[11px] text-sky-400 border border-slate-700">
              JavaFX UI &amp; PDF Export
            </span>
          </div>
          <button
            onClick={handleDownloadAllFiles}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition whitespace-nowrap ml-4"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All Java Files</span>
          </button>
        </div>

        {/* Body: Tabs & Code Viewer */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* File Tabs Sidebar */}
          <div className="w-full md:w-64 bg-slate-950/60 border-r border-slate-800 p-3 space-y-1.5 overflow-y-auto">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
              Project Files
            </div>
            {JAVA_PROJECT_FILES.map((file) => (
              <button
                key={file.filename}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center space-x-2.5 ${
                  selectedFile.filename === file.filename
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileCode className="w-4 h-4 shrink-0 text-cyan-400" />
                <div className="truncate">
                  <div className="truncate">{file.filename}</div>
                  <div className="text-[10px] text-slate-500 truncate">{file.language}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Code Viewer Panel */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            {/* Top Toolbar of the Code Viewer */}
            <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-300 truncate">
                <span className="font-mono text-cyan-400 font-semibold">{selectedFile.filename}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 text-[11px] truncate hidden sm:inline">
                  {selectedFile.description}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition border border-slate-700 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy File</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownloadSingleFile(selectedFile)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Download this file"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-y-auto p-4 text-slate-300 font-mono text-xs leading-relaxed">
              <pre className="select-text whitespace-pre overflow-x-auto">{selectedFile.content}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div>
            Requirements: <span className="text-slate-300 font-mono">JDK 17+</span>,{' '}
            <span className="text-slate-300 font-mono">Maven 3.8+</span>,{' '}
            <span className="text-slate-300 font-mono">Tesseract 5+</span> (or bundled Tess4J data)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
