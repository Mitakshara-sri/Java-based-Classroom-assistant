/**
 * HandROI Note Digitizer
 * Author: Mitakshara
 * Stack: React 19, TypeScript, MediaPipe / OpenCV Vision, Tesseract.js, SQLite Architecture
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CameraView } from './components/CameraView';
import { NotesList } from './components/NotesList';
import { CaptureReviewModal } from './components/CaptureReviewModal';
import { SqlConsoleModal } from './components/SqlConsoleModal';
import { JavaCompanionModal } from './components/JavaCompanionModal';
import { SettingsModal } from './components/SettingsModal';
import { CurrentROI, HandRoiSettings, Note } from './types';
import { dbService } from './services/db';
import { ExportService } from './services/exportService';
import {
  Camera,
  Database,
  Code,
  Download,
  Sparkles,
  Layers,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'database'>('scanner');
  const [notes, setNotes] = useState<Note[]>(() => dbService.getAllNotes());

  const [settings, setSettings] = useState<HandRoiSettings>({
    detectionMode: 'pointing',
    autoCapture: true,
    autoCaptureTrigger: 'hand_or_mouse',
    holdDurationSeconds: 1.2,
    enhanceContrast: true,
    showSkeleton: true,
    showBinaryMask: false,
    showHud: true,
    ocrLanguage: 'eng',
    soundEffects: true,
  });

  // Modal states
  const [captureModalData, setCaptureModalData] = useState<{
    roiImageDataUrl: string;
    fullImageDataUrl?: string;
    roi: CurrentROI;
  } | null>(null);

  const [showSqlConsole, setShowSqlConsole] = useState<boolean>(false);
  const [showJavaCompanion, setShowJavaCompanion] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshNotes = () => {
    setNotes(dbService.getAllNotes());
  };

  const handleUpdateSettings = (newSettings: Partial<HandRoiSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleCaptureRoi = (roiImageDataUrl: string, fullImageDataUrl: string, roi: CurrentROI) => {
    setCaptureModalData({ roiImageDataUrl, fullImageDataUrl, roi });
  };

  const handleSaveToDatabase = (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const saved = dbService.saveNote(noteData);
    refreshNotes();
    showToast(`Saved note "${saved.title}" to SQLite database!`);
  };

  const handleDeleteNote = (id: string) => {
    dbService.deleteNote(id);
    refreshNotes();
    showToast('Note deleted from database.');
  };

  const handleUpdateNote = (id: string, updates: Partial<Note>) => {
    dbService.updateNote(id, updates);
    refreshNotes();
    showToast('Note updated in database.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center space-x-2 px-4 py-2.5 bg-slate-900 border border-emerald-500/60 rounded-xl shadow-2xl text-emerald-300 text-xs font-medium animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        noteCount={notes.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSqlConsole={() => setShowSqlConsole(true)}
        onOpenJavaCompanion={() => setShowJavaCompanion(true)}
        onOpenSettings={() => setShowSettings(true)}
        onBatchExportPdf={() => ExportService.exportAllToPdf(notes)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'scanner' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive Computer Vision & Live Camera Viewport (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              <CameraView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onCaptureRoi={handleCaptureRoi}
              />
            </div>

            {/* Right: Real-time Notes & Quick Digest Feed (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Architecture Info Card */}
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    OpenCV + Tess4J Pipeline
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    Live Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time hand detection tracks your pointing index finger or two-hand frame to isolate text regions. Holding still for{' '}
                  <span className="text-cyan-300 font-mono font-semibold">
                    {settings.holdDurationSeconds.toFixed(1)}s
                  </span>{' '}
                  automatically captures the region and runs OCR text digitization.
                </p>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => setShowJavaCompanion(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>View Java 17+ Codebase</span>
                  </button>
                  <button
                    onClick={() => setShowSqlConsole(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Query SQLite</span>
                  </button>
                </div>
              </div>

              {/* Recent Saved Notes Sidebar */}
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    Saved Notes ({notes.length})
                  </span>
                  <button
                    onClick={() => setActiveTab('database')}
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {notes.slice(0, 4).map((note) => (
                    <div
                      key={note.id}
                      onClick={() => setActiveTab('database')}
                      className="p-3 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800/80 hover:border-slate-700 transition cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="text-cyan-400 font-medium">{note.category}</span>
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-semibold text-white text-xs truncate group-hover:text-cyan-300 transition">
                        {note.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-mono">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Full Database & Notes Manager View */
          <NotesList
            notes={notes}
            onDeleteNote={handleDeleteNote}
            onUpdateNote={handleUpdateNote}
            onSwitchToScanner={() => setActiveTab('scanner')}
            onOpenSqlConsole={() => setShowSqlConsole(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            HandROI Note Digitizer • Designed &amp; Developed by <span className="text-slate-300 font-medium">Mitakshara</span> • CV + OCR Engine
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowJavaCompanion(true)}
              className="text-slate-400 hover:text-white transition"
            >
              Java 17+ Architecture
            </button>
            <span>•</span>
            <button
              onClick={() => setShowSqlConsole(true)}
              className="text-slate-400 hover:text-white transition"
            >
              SQL Database Console
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {captureModalData && (
        <CaptureReviewModal
          roiImageDataUrl={captureModalData.roiImageDataUrl}
          fullImageDataUrl={captureModalData.fullImageDataUrl}
          roi={captureModalData.roi}
          language={settings.ocrLanguage}
          onSaveToDatabase={handleSaveToDatabase}
          onClose={() => setCaptureModalData(null)}
        />
      )}

      {showSqlConsole && (
        <SqlConsoleModal
          onClose={() => setShowSqlConsole(false)}
          onRefreshNotes={refreshNotes}
        />
      )}

      {showJavaCompanion && (
        <JavaCompanionModal onClose={() => setShowJavaCompanion(false)} />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
