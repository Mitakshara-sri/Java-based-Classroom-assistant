import React from 'react';
import {
  Settings,
  X,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  Globe,
  RotateCcw,
} from 'lucide-react';
import { HandRoiSettings } from '../types';

interface SettingsModalProps {
  settings: HandRoiSettings;
  onUpdateSettings: (newSettings: Partial<HandRoiSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Settings className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Scanner Settings</h2>
              <p className="text-xs text-slate-400">OpenCV &amp; Tess4J OCR Parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-slate-200 text-xs">
          {/* OCR Language */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              OCR Recognition Language
            </label>
            <select
              value={settings.ocrLanguage}
              onChange={(e) => onUpdateSettings({ ocrLanguage: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="eng">English (Tesseract eng.traineddata)</option>
              <option value="spa">Spanish (Español)</option>
              <option value="fra">French (Français)</option>
              <option value="deu">German (Deutsch)</option>
            </select>
          </div>

          {/* Auto-Capture Master & Condition */}
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-Capture Status
                </label>
                <p className="text-[11px] text-slate-400">
                  Automatically take snapshot when ROI is stabilized
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ autoCapture: !settings.autoCapture })}
                className={`px-3 py-1 rounded-lg border text-xs font-semibold transition ${
                  settings.autoCapture
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {settings.autoCapture ? 'ENABLED' : 'PAUSED'}
              </button>
            </div>

            {/* Auto-Capture Trigger Condition */}
            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Auto-Capture Trigger Condition
              </label>
              <select
                value={settings.autoCaptureTrigger || 'hand_or_mouse'}
                onChange={(e) =>
                  onUpdateSettings({ autoCaptureTrigger: e.target.value as any })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="hand_or_mouse">
                  Hand or Mouse (Only capture when hand or mouse specifies ROI)
                </option>
                <option value="hand_only">
                  Hand Gestures Only (Only when index pointing or framing hand is present)
                </option>
                <option value="mouse_only">
                  Mouse Selection Only (Only when user manually draws region with mouse)
                </option>
              </select>
              <p className="text-[10px] text-cyan-400/90 mt-1">
                ✓ Auto-capture will only trigger when region is specified by hand or manually by mouse.
              </p>
            </div>

            {/* Auto-Capture Stabilization Interval */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-300">
                  Stabilization Hold Duration
                </label>
                <span className="font-mono text-cyan-400 font-bold">
                  {settings.holdDurationSeconds.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={settings.holdDurationSeconds}
                onChange={(e) =>
                  onUpdateSettings({ holdDurationSeconds: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Time region must remain still before triggering auto-snap.
              </p>
            </div>
          </div>

          {/* Shutter Sound */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <div>
              <div className="font-semibold text-slate-300">Shutter Audio Feedback</div>
              <div className="text-[11px] text-slate-400">Play synthetic tone when ROI is captured</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ soundEffects: !settings.soundEffects })}
              className={`p-2 rounded-lg border transition ${
                settings.soundEffects
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {settings.soundEffects ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Contrast Preprocessing */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <div>
              <div className="font-semibold text-slate-300">Adaptive Image Enhancement</div>
              <div className="text-[11px] text-slate-400">Apply contrast stretching before OCR engine</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ enhanceContrast: !settings.enhanceContrast })}
              className={`px-3 py-1 rounded-lg border text-xs font-semibold transition ${
                settings.enhanceContrast
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {settings.enhanceContrast ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Skeletons & Debug HUD */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <div>
              <div className="font-semibold text-slate-300">OpenCV Diagnostics HUD</div>
              <div className="text-[11px] text-slate-400">Display live FPS, Gesture, and Pipeline status</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ showHud: !settings.showHud })}
              className={`px-3 py-1 rounded-lg border text-xs font-semibold transition ${
                settings.showHud
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {settings.showHud ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-800 border-t border-slate-700 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
