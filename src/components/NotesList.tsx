import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  FileText,
  Trash2,
  Edit3,
  Calendar,
  Layers,
  Sparkles,
  Tag,
  Eye,
  Check,
  Copy,
  ExternalLink,
  Code,
} from 'lucide-react';
import { Note } from '../types';
import { ExportService } from '../services/exportService';

interface NotesListProps {
  notes: Note[];
  onDeleteNote: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onSwitchToScanner: () => void;
  onOpenSqlConsole: () => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  onDeleteNote,
  onUpdateNote,
  onSwitchToScanner,
  onOpenSqlConsole,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract unique categories
  const categories = ['All', ...Array.from(new Set(notes.map((n) => n.category || 'General')))];

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const matchesCategory = selectedCategory === 'All' || n.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleCopyContent = (note: Note) => {
    navigator.clipboard.writeText(note.content);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    onUpdateNote(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      category: editingNote.category,
      tags: editingNote.tags,
    });
    setEditingNote(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-notes"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by keyword, code, or tag..."
            className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => ExportService.exportAllToPdf(notes)}
            disabled={notes.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium transition border border-slate-700 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export All PDF</span>
          </button>

          <button
            onClick={onOpenSqlConsole}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-mono transition border border-emerald-800/60"
          >
            <Code className="w-3.5 h-3.5 text-emerald-400" />
            <span>Query SQLite</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 p-4 shadow-lg hover:shadow-cyan-500/5 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* ROI Image Snapshot Thumbnail */}
                {note.roiImageDataUrl && (
                  <div
                    onClick={() => setPreviewImage(note.roiImageDataUrl)}
                    className="relative aspect-[16/9] w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 cursor-pointer group-hover:border-slate-700 transition flex items-center justify-center p-2"
                  >
                    <img
                      src={note.roiImageDataUrl}
                      alt={note.title}
                      className="w-full h-full object-contain rounded"
                    />
                    <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 text-white text-xs font-medium backdrop-blur-xs">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span>View Snapshot</span>
                    </div>
                  </div>
                )}

                {/* Category & Accuracy Badges */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-medium border border-slate-700">
                    {note.category}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <Sparkles className="w-3 h-3" />
                    {note.confidence.toFixed(1)}% OCR
                  </span>
                </div>

                {/* Note Title */}
                <h3 className="font-bold text-white text-sm tracking-tight line-clamp-1">
                  {note.title}
                </h3>

                {/* Digitized Content Snippet */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 text-xs font-mono text-slate-300 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {note.content}
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Metadata & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center space-x-1">
                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopyContent(note)}
                    title="Copy Content"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    {copiedId === note.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  {/* Export PDF */}
                  <button
                    onClick={() => ExportService.exportNoteToPdf(note)}
                    title="Export as PDF Document"
                    className="p-1.5 text-amber-400/80 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Export TXT */}
                  <button
                    onClick={() => ExportService.exportNoteToTxt(note)}
                    title="Export as Plain Text (.txt)"
                    className="p-1.5 text-cyan-400/80 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setEditingNote(note)}
                    title="Edit Note Record"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm(`Delete note "${note.title}" from database?`)) {
                        onDeleteNote(note.id);
                      }
                    }}
                    title="Delete Note from Database"
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 text-center bg-slate-900/60 rounded-2xl border border-slate-800 p-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-white text-base mb-1">
            {searchQuery ? 'No matching notes found' : 'No Digitized Notes in Database Yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
            {searchQuery
              ? 'Try changing your search keywords or switching category filters.'
              : 'Scan any printed text or book region using real-time OpenCV hand detection or sample document feeds.'}
          </p>
          <button
            onClick={onSwitchToScanner}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition"
          >
            Launch Live CV Scanner
          </button>
        </div>
      )}

      {/* Full Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-3xl max-h-[85vh] bg-slate-900 p-3 rounded-2xl border border-slate-700 shadow-2xl relative">
            <img
              src={previewImage}
              alt="ROI Zoom"
              className="max-h-[75vh] w-auto object-contain rounded-xl"
            />
            <div className="text-center pt-2 text-xs text-slate-400">
              Captured Region of Interest (High-Resolution Snapshot) • Click anywhere to close
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">Edit SQLite Note Record</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Title</label>
              <input
                type="text"
                value={editingNote.title}
                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <input
                type="text"
                value={editingNote.category}
                onChange={(e) => setEditingNote({ ...editingNote, category: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Content</label>
              <textarea
                rows={6}
                value={editingNote.content}
                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-xs font-mono resize-none focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
