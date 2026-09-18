export interface Note {
  id: string;
  title: string;
  content: string;
  roiImageDataUrl: string;
  fullImageDataUrl?: string;
  confidence: number;
  category: string;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  roiBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type DetectionMode = 'pointing' | 'two-hand-frame' | 'pinch' | 'manual' | 'contour';

export type AutoCaptureTrigger = 'hand_or_mouse' | 'hand_only' | 'mouse_only';

export interface HandRoiSettings {
  detectionMode: DetectionMode;
  autoCapture: boolean;
  autoCaptureTrigger: AutoCaptureTrigger;
  holdDurationSeconds: number;
  enhanceContrast: boolean;
  showSkeleton: boolean;
  showBinaryMask: boolean;
  showHud: boolean;
  ocrLanguage: string;
  soundEffects: boolean;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface DetectedHand {
  landmarks: LandmarkPoint[];
  handedness: 'Left' | 'Right' | 'Unknown';
  score: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  gesture: 'pointing' | 'framing' | 'open_palm' | 'fist' | 'pinch' | 'none';
  tipPoint?: LandmarkPoint;
}

export interface CurrentROI {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  stableProgress: number; // 0 to 1
  isStable: boolean;
  source: 'hand-pointing' | 'two-hand-frame' | 'manual' | 'mouse' | 'contour';
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OcrResult {
  text: string;
  confidence: number;
  lines: string[];
  words: OcrWord[];
  processingTimeMs: number;
  preprocessedDataUrl?: string;
  binaryDataUrl?: string;
  rawText?: string;
  qualityScore?: number;
  correctionsCount?: number;
  preset?: 'printed' | 'handwritten' | 'code' | 'numbers';
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  message?: string;
}
