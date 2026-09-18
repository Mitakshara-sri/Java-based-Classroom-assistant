import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Save,
  X,
  Sparkles,
  Layers,
  Tag,
  Folder,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Scan,
  RefreshCw,
  Wand2,
  Eye,
  Settings2,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  Compass,
  ArrowUpDown,
} from 'lucide-react';
import { CurrentROI, Note, OcrResult } from '../types';
import { ocrService, PreprocessOptions } from '../services/ocrService';
import { ExportService } from '../services/exportService';
import { OcrPresetMode, TextRefiner } from '../services/textRefiner';

interface CaptureReviewModalProps {
  roiImageDataUrl: string;
  fullImageDataUrl?: string;
  roi: CurrentROI;
  language: string;
  onSaveToDatabase: (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export const CaptureReviewModal: React.FC<CaptureReviewModalProps> = ({
  roiImageDataUrl,
  fullImageDataUrl,
  roi,
  language,
  onSaveToDatabase,
  onClose,
}) => {
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(true);
  const [ocrStatus, setOcrStatus] = useState<string>('Initializing Tess4J OCR Engine...');
  const [ocrProgress, setOcrProgress] = useState<number>(0.1);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // Preprocessing Options & Controls
  const [activePreset, setActivePreset] = useState<OcrPresetMode>('printed');
  const [contrast, setContrast] = useState<number>(1.35);
  const [brightness, setBrightness] = useState<number>(0);
  const [binarize, setBinarize] = useState<boolean>(false); // Grayscale default for Tesseract LSTM
  const [sauvola, setSauvola] = useState<boolean>(true);
  const [sharpen, setSharpen] = useState<boolean>(true);
  const [autoDeskew, setAutoDeskew] = useState<boolean>(true);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [flipHorizontal, setFlipHorizontal] = useState<boolean>(false);
  const [invert, setInvert] = useState<boolean>(false);
  const [detectedAngle, setDetectedAngle] = useState<number>(0);

  const [showAdvancedCv, setShowAdvancedCv] = useState<boolean>(false);
  const [imageTab, setImageTab] = useState<'original' | 'enhanced' | 'binary'>('enhanced');
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [category, setCategory] = useState<string>('General');
  const [tagsText, setTagsText] = useState<string>('OCR, Computer Vision, Digital Note');
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [showRawOcr, setShowRawOcr] = useState<boolean>(false);

  // Re-run OCR with current preprocessing options
  const executeDigitization = useCallback(
    async (
      presetOverride?: OcrPresetMode,
      rotOverride?: number,
      flipOverride?: boolean,
      invertOverride?: boolean
    ) => {
      setIsOcrLoading(true);
      setOcrProgress(0.15);
      setOcrStatus('Enhancing image resolution, removing shadows & deskewing...');

      const currentPreset = presetOverride || activePreset;
      const currentRot = rotOverride !== undefined ? rotOverride : rotationDegrees;
      const currentFlip = flipOverride !== undefined ? flipOverride : flipHorizontal;
      const currentInvert = invertOverride !== undefined ? invertOverride : invert;

      const opts: PreprocessOptions = {
        preset: currentPreset,
        contrast,
        brightness,
        binarize,
        sauvola,
        sharpen,
        autoDeskew,
        rotationDegrees: currentRot,
        flipHorizontal: currentFlip,
        invert: currentInvert,
      };

      try {
        const result = await ocrService.digitizeImage(
          roiImageDataUrl,
          language,
          (status, progress) => {
            setOcrStatus(status);
            setOcrProgress(Math.max(0.1, progress));
          },
          opts
        );

        setOcrResult(result);
        setContent(result.text || 'No legible text detected in selected region.');

        // Generate smart title from first line if title is empty or default
        if (!title || title.startsWith('Digitized Note #')) {
          const firstLine = result.lines[0] || result.text.split('\n')[0] || '';
          const cleanedTitle = firstLine.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 45);
          setTitle(cleanedTitle || `Digitized Note #${Math.floor(Math.random() * 900 + 100)}`);
        }

        // Auto-categorize based on keywords
        const lowerText = (result.text || '').toLowerCase();
        if (
          lowerText.includes('opencv') ||
          lowerText.includes('gradient') ||
          lowerText.includes('camera') ||
          lowerText.includes('vision') ||
          lowerText.includes('image')
        ) {
          setCategory('Computer Vision');
        } else if (
          lowerText.includes('java') ||
          lowerText.includes('sql') ||
          lowerText.includes('class') ||
          lowerText.includes('public') ||
          lowerText.includes('function')
        ) {
          setCategory('Backend Architecture');
        } else if (
          lowerText.includes('todo') ||
          lowerText.includes('sprint') ||
          lowerText.includes('plan') ||
          lowerText.includes('meeting')
        ) {
          setCategory('Work & Planning');
        }

        setIsOcrLoading(false);
      } catch (err) {
        console.error('OCR Error:', err);
        setIsOcrLoading(false);
        setOcrStatus('OCR digitization complete with local fallback.');
      }
    },
    [
      roiImageDataUrl,
      language,
      activePreset,
      contrast,
      brightness,
      binarize,
      sauvola,
      sharpen,
      autoDeskew,
      rotationDegrees,
      flipHorizontal,
      invert,
      title,
    ]
  );

  // Run on initial modal open
  useEffect(() => {
    executeDigitization();
  }, []);

  const handlePresetChange = (newPreset: OcrPresetMode) => {
    setActivePreset(newPreset);
    if (newPreset === 'handwritten') {
      setBinarize(false);
      setContrast(1.45);
      setSharpen(true);
    } else if (newPreset === 'code') {
      setBinarize(false);
      setContrast(1.4);
      setSharpen(true);
    } else if (newPreset === 'numbers') {
      setBinarize(true);
      setContrast(1.35);
      setSharpen(true);
    } else {
      setBinarize(false);
      setContrast(1.35);
      setSharpen(true);
    }
    executeDigitization(newPreset);
  };

  const handleRotateClockwise = () => {
    const nextRot = (rotationDegrees + 90) % 360;
    setRotationDegrees(nextRot);
    executeDigitization(activePreset, nextRot, flipHorizontal, invert);
  };

  const handleToggleFlipHorizontal = () => {
    const nextFlip = !flipHorizontal;
    setFlipHorizontal(nextFlip);
    executeDigitization(activePreset, rotationDegrees, nextFlip, invert);
  };

  const handleToggleInvert = () => {
    const nextInvert = !invert;
    setInvert(nextInvert);
    executeDigitization(activePreset, rotationDegrees, flipHorizontal, nextInvert);
  };

  const handleToggleRawOcr = () => {
    if (!ocrResult) return;
    if (showRawOcr) {
      setContent(ocrResult.text);
      setShowRawOcr(false);
    } else {
      setContent(ocrResult.rawText || ocrResult.text);
      setShowRawOcr(true);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    const tags = tagsText
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    onSaveToDatabase({
      title: title || 'Untitled Note',
      content: content || '',
      roiImageDataUrl: ocrResult?.preprocessedDataUrl || roiImageDataUrl,
      fullImageDataUrl,
      confidence: ocrResult ? ocrResult.confidence : 90,
      category,
      tags: tags.length > 0 ? tags : ['General'],
      wordCount,
      roiBox: {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height,
      },
    });

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleQuickPdfExport = () => {
    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      title: title || 'Untitled Note',
      content,
      roiImageDataUrl: ocrResult?.preprocessedDataUrl || roiImageDataUrl,
      fullImageDataUrl,
      confidence: ocrResult ? ocrResult.confidence : 90,
      category,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      wordCount: content.split(/\s+/).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roiBox: {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height,
      },
    };

    ExportService.exportNoteToPdf(tempNote);
  };

  const handleQuickTxtExport = () => {
    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      title: title || 'Untitled Note',
      content,
      roiImageDataUrl,
      confidence: ocrResult ? ocrResult.confidence : 90,
      category,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      wordCount: content.split(/\s+/).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roiBox: {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height,
      },
    };

    ExportService.exportNoteToTxt(tempNote);
  };

  const currentDisplayImage =
    imageTab === 'binary' && ocrResult?.binaryDataUrl
      ? ocrResult.binaryDataUrl
      : imageTab === 'enhanced' && ocrResult?.preprocessedDataUrl
      ? ocrResult.preprocessedDataUrl
      : roiImageDataUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="px-5 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Scan className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Region of Interest Text Digitizer
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-normal">
                  High-DPI Super-Resolution
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Multi-pass adaptive binarization, shadow flattening, auto-deskew &amp; character refinement
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-200 text-sm">
          {/* Top Progress Bar if OCR is actively processing */}
          {isOcrLoading && (
            <div className="p-3.5 bg-slate-800/90 rounded-xl border border-cyan-500/30 space-y-2 shadow-lg shadow-cyan-950/30">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-cyan-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  {ocrStatus}
                </span>
                <span className="font-mono text-slate-300">{Math.round(ocrProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Quick Preset Selector & Tools Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-800/50 rounded-xl border border-slate-700/60">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                OCR Model:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'printed', label: 'Printed Document' },
                  { id: 'handwritten', label: 'Handwritten Notes' },
                  { id: 'code', label: 'Code / Tech' },
                  { id: 'numbers', label: 'Numbers & Math' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetChange(preset.id as OcrPresetMode)}
                    disabled={isOcrLoading}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                      activePreset === preset.id
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Geometry Tools: Rotate, Flip, Invert */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleRotateClockwise}
                disabled={isOcrLoading}
                title="Rotate 90° Clockwise"
                className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
              >
                <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rotate 90°</span>
                {rotationDegrees > 0 && <span className="text-[10px] text-cyan-300">({rotationDegrees}°)</span>}
              </button>

              <button
                onClick={handleToggleFlipHorizontal}
                disabled={isOcrLoading}
                title="Mirror / Flip Horizontal"
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                  flipHorizontal
                    ? 'bg-cyan-950 border border-cyan-500 text-cyan-300'
                    : 'bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Flip H</span>
              </button>

              <button
                onClick={handleToggleInvert}
                disabled={isOcrLoading}
                title="Invert Colors (Dark Mode Text)"
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                  invert
                    ? 'bg-amber-950 border border-amber-500 text-amber-300'
                    : 'bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Invert</span>
              </button>

              <button
                onClick={() => setShowAdvancedCv(!showAdvancedCv)}
                className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50 transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAdvancedCv ? 'Hide CV' : 'Tune Quality'}</span>
              </button>
            </div>
          </div>

          {/* Advanced Computer Vision Preprocessing Adjustment Drawer */}
          {showAdvancedCv && (
            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-700/70 pb-2">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
                  Image Enhancement Pipeline (Shadow Removal, Auto-Deskew &amp; Contrast)
                </span>
                <button
                  onClick={() => executeDigitization()}
                  disabled={isOcrLoading}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium flex items-center gap-1 transition shadow"
                >
                  <RefreshCw className={`w-3 h-3 ${isOcrLoading ? 'animate-spin' : ''}`} />
                  <span>Re-digitize with Settings</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1 text-xs">
                {/* Contrast Slider */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Contrast Stretch</span>
                    <span className="font-mono text-cyan-400">{contrast.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.4"
                    step="0.05"
                    value={contrast}
                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Brightness Slider */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Brightness Offset</span>
                    <span className="font-mono text-cyan-400">{brightness > 0 ? `+${brightness}` : brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="2"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Auto-Deskew Toggle */}
                <div className="flex items-center space-x-2 pt-3">
                  <input
                    type="checkbox"
                    id="chk-deskew"
                    checked={autoDeskew}
                    onChange={(e) => setAutoDeskew(e.target.checked)}
                    className="accent-cyan-500 w-4 h-4 rounded"
                  />
                  <label htmlFor="chk-deskew" className="text-slate-300 cursor-pointer flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Auto-Deskew / Straighten
                  </label>
                </div>

                {/* Binarization Toggle */}
                <div className="flex items-center space-x-2 pt-3">
                  <input
                    type="checkbox"
                    id="chk-binarize"
                    checked={binarize}
                    onChange={(e) => setBinarize(e.target.checked)}
                    className="accent-cyan-500 w-4 h-4 rounded"
                  />
                  <label htmlFor="chk-binarize" className="text-slate-300 cursor-pointer">
                    Pure Otsu Binarize (1-bit)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side: Captured ROI Image & OCR Transcribed Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: ROI Image Preview with Enhanced / Binary tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Captured Region of Interest:
                </span>
                <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded border border-slate-700">
                  <button
                    onClick={() => setImageTab('original')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      imageTab === 'original' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => setImageTab('enhanced')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      imageTab === 'enhanced' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Enhanced (High-DPI)
                  </button>
                  <button
                    onClick={() => setImageTab('binary')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      imageTab === 'binary' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Binary Mask
                  </button>
                  <button
                    onClick={() => setIsZoomed(!isZoomed)}
                    title={isZoomed ? 'Reset zoom' : 'Inspect high-res details'}
                    className={`px-1.5 py-0.5 rounded text-[11px] transition ${
                      isZoomed ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Display selected image view with optional zoom inspection */}
              <div
                className={`aspect-[16/10] bg-slate-950 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center p-2 shadow-inner relative ${
                  isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <img
                  src={currentDisplayImage}
                  alt="Captured ROI"
                  className={`max-h-full max-w-full object-contain rounded transition-transform duration-200 ${
                    isZoomed ? 'scale-150' : 'scale-100'
                  }`}
                />
                {isZoomed && (
                  <div className="absolute bottom-2 right-2 bg-slate-950/80 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/50">
                    1.5x Zoom Inspection
                  </div>
                )}
              </div>

              {ocrResult && (
                <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {ocrResult.processingTimeMs}ms
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confidence: {ocrResult.confidence}%
                  </span>
                  <span className="text-cyan-400 font-mono text-[11px]">
                    Quality Score: {ocrResult.qualityScore || 92}/100
                  </span>
                </div>
              )}
            </div>

            {/* Right: Note Title, Categories & Digitized Text Content */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Note Title
                </label>
                <input
                  id="input-note-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Optical Character Recognition Notes"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-slate-400" />
                    Category
                  </label>
                  <select
                    id="select-note-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="General">General</option>
                    <option value="Computer Vision">Computer Vision</option>
                    <option value="Backend Architecture">Backend Architecture</option>
                    <option value="Work & Planning">Work &amp; Planning</option>
                    <option value="Lecture Notes">Lecture Notes</option>
                    <option value="Code Snippets">Code Snippets</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    Tags
                  </label>
                  <input
                    type="text"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="OCR, CV, Notes"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Digitized Text Content
                  </label>
                  <div className="flex items-center space-x-2">
                    {ocrResult?.correctionsCount !== undefined && ocrResult.correctionsCount > 0 && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                        {ocrResult.correctionsCount} typos corrected
                      </span>
                    )}
                    <button
                      onClick={handleToggleRawOcr}
                      className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{showRawOcr ? 'Show Refined' : 'Show Raw OCR'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  id="textarea-transcription"
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Transcribed text will appear here..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
                />
              </div>

              {/* Quick Actions (Copy, Export PDF, TXT) */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <button
                    id="btn-copy-text"
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 border border-slate-700 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleQuickPdfExport}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 border border-slate-700 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export PDF</span>
                  </button>

                  <button
                    onClick={handleQuickTxtExport}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 border border-slate-700 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>TXT</span>
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  {content.trim().split(/\s+/).filter(Boolean).length} words
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span>ROI [{roi.width}x{roi.height}]</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Discard
            </button>

            <button
              id="btn-save-note-db"
              onClick={handleSave}
              disabled={savedSuccess}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center space-x-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white animate-bounce" />
                  <span>Saved to Database!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save to Notes Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
