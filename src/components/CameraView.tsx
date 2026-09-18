import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Layers,
  Hand,
  Crosshair,
  Volume2,
  VolumeX,
  FileImage,
  UploadCloud,
  Play,
  Pause,
  ExternalLink,
  AlertTriangle,
  Upload,
  Video,
  Info,
  ChevronDown,
  ShieldAlert,
  Laptop,
  MousePointer,
  MousePointerClick,
} from 'lucide-react';
import { CurrentROI, DetectedHand, DetectionMode, HandRoiSettings } from '../types';
import { cvEngine } from '../services/cvEngine';
import { SAMPLE_FEEDS, SampleFeed } from '../data/sampleFeeds';

interface CameraViewProps {
  settings: HandRoiSettings;
  onUpdateSettings: (newSettings: Partial<HandRoiSettings>) => void;
  onCaptureRoi: (roiImageDataUrl: string, fullImageDataUrl: string, roi: CurrentROI) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  settings,
  onUpdateSettings,
  onCaptureRoi,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sampleImgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Feed modes: 'webcam' (live laptop camera), 'sample' (preset document feeds), 'upload' (local laptop file)
  const [feedMode, setFeedMode] = useState<'webcam' | 'sample' | 'upload'>('webcam');
  const [selectedSample, setSelectedSample] = useState<SampleFeed>(SAMPLE_FEEDS[0]);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);

  // Camera stream & hardware states
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraResolution, setCameraResolution] = useState<string>('');

  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [currentFps, setCurrentFps] = useState<number>(30);
  const [detectedHandsCount, setDetectedHandsCount] = useState<number>(0);
  const [activeGesture, setActiveGesture] = useState<string>('none');
  const [latestRoi, setLatestRoi] = useState<CurrentROI | null>(null);
  const [binaryMaskUrl, setBinaryMaskUrl] = useState<string | null>(null);

  // Manual ROI coordinates if user drags or adjusts with mouse
  const [manualRoi, setManualRoi] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Mouse drag selection states
  const [isMouseDragging, setIsMouseDragging] = useState<boolean>(false);
  const [mouseDragStart, setMouseDragStart] = useState<{ clientX: number; clientY: number } | null>(null);
  const [mouseDragCurrent, setMouseDragCurrent] = useState<{ clientX: number; clientY: number } | null>(null);
  const [mouseSelectionNotice, setMouseSelectionNotice] = useState<string | null>(null);
  const [sampleMouseStabilizeTime, setSampleMouseStabilizeTime] = useState<number | null>(null);
  const [sampleMouseCapturedKey, setSampleMouseCapturedKey] = useState<string | null>(null);

  const requestRef = useRef<number | null>(null);

  // Check if running in an iframe (e.g. AI Studio preview)
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleOpenStandalone = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  // Audio chirp on auto-capture
  const playShutterSound = useCallback(() => {
    if (!settings.soundEffects) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.08); // A6
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch {
      // Audio context may be restricted before user interaction
    }
  }, [settings.soundEffects]);

  // Execute snapshot of active ROI
  const triggerCapture = useCallback(
    (roiToCapture?: CurrentROI) => {
      const roi = roiToCapture || latestRoi;
      if (!roi) {
        setMouseSelectionNotice(
          settings.detectionMode === 'manual'
            ? 'Please drag your mouse over the text or paper to specify a region.'
            : 'No region detected. Point your index finger at the text or drag a box with your mouse.'
        );
        setTimeout(() => setMouseSelectionNotice(null), 3500);
        return;
      }

      // Flash visual feedback
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 200);
      playShutterSound();

      let roiDataUrl = '';
      let fullDataUrl = '';

      if (feedMode === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
        const { roiCanvas, fullCanvas } = cvEngine.captureRoiImage(videoRef.current, roi);
        roiDataUrl = roiCanvas.toDataURL('image/png');
        fullDataUrl = fullCanvas.toDataURL('image/png');
      } else if (sampleImgRef.current) {
        // Capture from sample or uploaded image
        const img = sampleImgRef.current;
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = img.naturalWidth || 640;
        fullCanvas.height = img.naturalHeight || 480;
        const fullCtx = fullCanvas.getContext('2d');
        if (fullCtx) {
          fullCtx.drawImage(img, 0, 0);
          fullDataUrl = fullCanvas.toDataURL('image/png');

          const roiCanvas = document.createElement('canvas');
          roiCanvas.width = roi.width;
          roiCanvas.height = roi.height;
          const roiCtx = roiCanvas.getContext('2d');
          if (roiCtx) {
            roiCtx.drawImage(
              img,
              roi.x,
              roi.y,
              roi.width,
              roi.height,
              0,
              0,
              roi.width,
              roi.height
            );
            roiDataUrl = roiCanvas.toDataURL('image/png');
          }
        }
      }

      if (roiDataUrl) {
        onCaptureRoi(roiDataUrl, fullDataUrl, roi);
      }
    },
    [latestRoi, feedMode, playShutterSound, onCaptureRoi]
  );

  /**
   * Convert screen client (X, Y) to exact internal canvas pixel coordinates
   */
  const getCanvasCoordinatesFromClient = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const canvasAspect = canvas.width / canvas.height;
    const containerAspect = rect.width / rect.height;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > canvasAspect) {
      renderWidth = rect.height * canvasAspect;
      offsetX = (rect.width - renderWidth) / 2;
    } else {
      renderHeight = rect.width / canvasAspect;
      offsetY = (rect.height - renderHeight) / 2;
    }

    const clickX = clientX - rect.left - offsetX;
    const clickY = clientY - rect.top - offsetY;

    const clampedX = Math.max(0, Math.min(renderWidth, clickX));
    const clampedY = Math.max(0, Math.min(renderHeight, clickY));

    const scale = canvas.width / renderWidth;
    let x = clampedX * scale;
    let y = clampedY * scale;

    if (feedMode === 'webcam' && isMirrored) {
      x = canvas.width - x;
    }

    return {
      x: Math.round(Math.max(0, Math.min(canvas.width, x))),
      y: Math.round(Math.max(0, Math.min(canvas.height, y))),
    };
  };

  /**
   * Mouse events to specify custom region of interest directly on the site
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only primary left button
    if (e.button !== 0) return;
    setIsMouseDragging(true);
    setMouseDragStart({ clientX: e.clientX, clientY: e.clientY });
    setMouseDragCurrent({ clientX: e.clientX, clientY: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDragging) return;
    setMouseDragCurrent({ clientX: e.clientX, clientY: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isMouseDragging || !mouseDragStart || !mouseDragCurrent) {
      setIsMouseDragging(false);
      setMouseDragStart(null);
      setMouseDragCurrent(null);
      return;
    }

    const pt1 = getCanvasCoordinatesFromClient(mouseDragStart.clientX, mouseDragStart.clientY);
    const pt2 = getCanvasCoordinatesFromClient(mouseDragCurrent.clientX, mouseDragCurrent.clientY);

    setIsMouseDragging(false);
    setMouseDragStart(null);
    setMouseDragCurrent(null);

    if (pt1 && pt2) {
      const x = Math.min(pt1.x, pt2.x);
      const y = Math.min(pt1.y, pt2.y);
      const width = Math.abs(pt2.x - pt1.x);
      const height = Math.abs(pt2.y - pt1.y);

      // Require minimal box size
      if (width >= 24 && height >= 16) {
        const newBox = { x, y, width, height };
        setManualRoi(newBox);
        cvEngine.resetManualCaptureState();

        // Switch to manual mode if in gesture mode so the user's box is active
        if (settings.detectionMode !== 'manual') {
          onUpdateSettings({ detectionMode: 'manual' });
        }

        // Reset sample mode stabilization timer
        setSampleMouseStabilizeTime(performance.now());
        setSampleMouseCapturedKey(null);

        const autoMsg = settings.autoCapture
          ? `Auto-capturing after ${settings.holdDurationSeconds}s steady hold...`
          : 'Press "Capture" or Space to scan.';
        setMouseSelectionNotice(`Region specified by mouse [${width}x${height}]. ${autoMsg}`);
        setTimeout(() => setMouseSelectionNotice(null), 3500);
      }
    }
  };

  /**
   * Request webcam stream with progressive fallback tiers.
   * Laptop webcams commonly fail if 'facingMode: user' or exact resolutions are mandated.
   */
  const requestWebcamStream = async (deviceId?: string): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('navigator.mediaDevices.getUserMedia is not supported by your browser.');
    }

    const attempts: MediaStreamConstraints[] = [];

    // Tier 1: User explicitly specified a deviceId with Full HD 1080p requested
    if (deviceId) {
      attempts.push({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      attempts.push({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      attempts.push({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
    }

    // Tier 2: Ultra High Definition 1080p (Crucial for crisp text character edges)
    attempts.push({
      video: {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
      audio: false,
    });

    // Tier 3: Standard 720p HD
    attempts.push({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });

    // Tier 4: Relaxed resolution without facingMode (crucial for integrated laptop cameras)
    attempts.push({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    // Tier 5: Basic fallback
    attempts.push({
      video: true,
      audio: false,
    });

    let lastError: any = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Attempt to apply hardware focus and exposure optimization if supported
        try {
          const track = stream.getVideoTracks()[0];
          if (track && typeof (track as any).getCapabilities === 'function') {
            const caps = (track as any).getCapabilities();
            const advanced: any = {};
            if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              advanced.focusMode = 'continuous';
            }
            if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
              advanced.exposureMode = 'continuous';
            }
            if (Object.keys(advanced).length > 0 && typeof track.applyConstraints === 'function') {
              track.applyConstraints({ advanced: [advanced] }).catch(() => {});
            }
          }
        } catch (focusErr) {
          // Non-critical if browser ignores advanced focus constraints
        }

        return stream;
      } catch (err: any) {
        lastError = err;
        // If user actively blocked permission, don't keep cycling
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw err;
        }
      }
    }

    throw lastError || new Error('Could not access laptop webcam with any configuration.');
  };

  /**
   * Initialize or switch camera stream
   */
  const startCamera = useCallback(
    async (targetDeviceId?: string) => {
      setCameraError(null);
      setIsStartingCamera(true);

      // Stop existing stream if running
      if (videoRef.current && videoRef.current.srcObject) {
        const existing = videoRef.current.srcObject as MediaStream;
        existing.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }

      try {
        const deviceToUse = targetDeviceId !== undefined ? targetDeviceId : selectedDeviceId;
        const stream = await requestWebcamStream(deviceToUse || undefined);

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('autoplay', 'true');
          video.muted = true;

          video.onloadedmetadata = async () => {
            try {
              await video.play();
            } catch (playErr) {
              console.warn('Video play triggered exception:', playErr);
            }
            setIsCameraActive(true);
            setIsStartingCamera(false);
            setCameraResolution(`${video.videoWidth}x${video.videoHeight}`);
          };

          // Try immediate play as well
          try {
            await video.play();
            setIsCameraActive(true);
            setIsStartingCamera(false);
          } catch (e) {
            // Expected on some browsers until metadata loads
          }
        }

        // Query available video devices so user can switch cameras
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableDevices(videoInputs);

          const track = stream.getVideoTracks()[0];
          const trackSettings = track?.getSettings();
          if (trackSettings?.deviceId && !deviceToUse) {
            setSelectedDeviceId(trackSettings.deviceId);
          }
        } catch (e) {
          console.warn('enumerateDevices error:', e);
        }
      } catch (err: any) {
        console.warn('Webcam initialization failed:', err);
        setIsCameraActive(false);
        setIsStartingCamera(false);

        let friendlyMsg = 'Webcam input was not detected on your laptop.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          friendlyMsg =
            'Camera permission was blocked by the browser. Click the lock or camera icon in the URL bar to allow access, or click "Open in Standalone Tab" below.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          friendlyMsg =
            'No webcam was detected on your laptop. Check if your laptop privacy shutter is closed, or plug in a USB camera.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          friendlyMsg =
            'Your laptop camera is currently in use by another program (e.g. Zoom, Teams, Meet, or Skype). Please close the other program and retry.';
        } else if (err.name === 'OverconstrainedError') {
          friendlyMsg = 'The requested video format is not supported by your camera hardware.';
        } else if (err.message) {
          friendlyMsg = err.message;
        }

        setCameraError(friendlyMsg);
      }
    },
    [selectedDeviceId]
  );

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
      setIsStartingCamera(false);
    }
  }, []);

  // Handle feed mode switching
  useEffect(() => {
    if (feedMode === 'webcam') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [feedMode, startCamera, stopCamera]);

  // Handle local laptop image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setUploadedImageSrc(result);
        setFeedMode('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  // Main processing animation loop
  useEffect(() => {
    const processLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        requestRef.current = requestAnimationFrame(processLoop);
        return;
      }

      if (feedMode === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const result = cvEngine.processFrame(
          video,
          canvas,
          settings,
          manualRoi || undefined,
          (autoRoi) => {
            triggerCapture(autoRoi);
          }
        );

        setCurrentFps(result.fps);
        setDetectedHandsCount(result.hands.length);
        if (result.hands.length > 0) {
          setActiveGesture(result.hands[0].gesture);
        } else {
          setActiveGesture('none');
        }
        setLatestRoi(result.roi);

        if (result.binaryMaskCanvas && settings.showBinaryMask) {
          setBinaryMaskUrl(result.binaryMaskCanvas.toDataURL());
        }
      } else if (feedMode !== 'webcam' && sampleImgRef.current) {
        // When using sample feed or uploaded image
        const img = sampleImgRef.current;
        if (canvas.width !== (img.naturalWidth || 640)) {
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 480;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const activeBox = manualRoi || (feedMode === 'sample'
            ? selectedSample.defaultRoi
            : { x: 40, y: 40, width: Math.min(480, canvas.width - 80), height: Math.min(260, canvas.height - 80) });

          const boxKey = `${activeBox.x},${activeBox.y},${activeBox.width},${activeBox.height}`;
          const isAlreadyCaptured = sampleMouseCapturedKey === boxKey;

          let progress = 0;
          let isStable = false;

          const triggerAllowed =
            settings.autoCapture &&
            (settings.autoCaptureTrigger === 'hand_or_mouse' || settings.autoCaptureTrigger === 'mouse_only');

          if (isAlreadyCaptured) {
            progress = 1.0;
            isStable = true;
          } else if (triggerAllowed && sampleMouseStabilizeTime) {
            const holdMs = settings.holdDurationSeconds * 1000;
            const elapsed = performance.now() - sampleMouseStabilizeTime;
            progress = Math.min(1.0, elapsed / holdMs);
            if (progress >= 1.0) {
              isStable = true;
              setSampleMouseCapturedKey(boxKey);
              const capturedRoi: CurrentROI = {
                ...activeBox,
                confidence: 0.99,
                stableProgress: 1.0,
                isStable: true,
                source: 'mouse',
              };
              triggerCapture(capturedRoi);
            }
          }

          const sampleRoi: CurrentROI = {
            ...activeBox,
            confidence: 0.99,
            stableProgress: progress,
            isStable: isStable,
            source: 'mouse',
          };

          setLatestRoi(sampleRoi);
          setCurrentFps(60);
          setDetectedHandsCount(0);
          setActiveGesture('mouse-selection');

          // Draw bounding box
          ctx.strokeStyle = isStable ? '#10b981' : '#06b6d4';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(sampleRoi.x, sampleRoi.y, sampleRoi.width, sampleRoi.height);

          ctx.fillStyle = isStable ? 'rgba(16, 185, 129, 0.08)' : 'rgba(6, 182, 212, 0.08)';
          ctx.fillRect(sampleRoi.x, sampleRoi.y, sampleRoi.width, sampleRoi.height);

          // Tag
          ctx.font = '11px "Fira Code", monospace';
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(sampleRoi.x, sampleRoi.y - 24, 250, 22);
          ctx.fillStyle = isStable ? '#34d399' : '#38bdf8';
          ctx.fillText(
            `ROI [${sampleRoi.width}x${sampleRoi.height}] • ${feedMode === 'upload' ? 'UPLOADED NOTE' : 'MOUSE ROI'}`,
            sampleRoi.x + 8,
            sampleRoi.y - 8
          );

          // Circular countdown ring if auto-capturing
          if (triggerAllowed && progress > 0) {
            const ringRadius = 14;
            const ringX = sampleRoi.x + sampleRoi.width - 20;
            const ringY = Math.max(20, sampleRoi.y - 14);

            ctx.beginPath();
            ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(ringX, ringY, ringRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
            ctx.strokeStyle = isAlreadyCaptured ? '#059669' : progress >= 1 ? '#10b981' : '#f59e0b';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = isAlreadyCaptured ? '8px sans-serif' : '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              isAlreadyCaptured ? 'SAVED' : progress >= 1 ? 'SNAP' : `${Math.round(progress * 100)}%`,
              ringX,
              ringY
            );
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
          }
        }
      }

      requestRef.current = requestAnimationFrame(processLoop);
    };

    requestRef.current = requestAnimationFrame(processLoop);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [feedMode, settings, manualRoi, selectedSample, uploadedImageSrc, triggerCapture]);

  // Spacebar shortcut to trigger ROI capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA' &&
        (e.target as HTMLElement).tagName !== 'INPUT'
      ) {
        e.preventDefault();
        triggerCapture();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerCapture]);

  return (
    <div className="space-y-4">
      {/* Hidden File Input for Laptop Document/Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Video Viewport Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative aspect-[4/3] max-h-[500px] w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group select-none ${
          isMouseDragging || settings.detectionMode === 'manual' ? 'cursor-crosshair' : 'cursor-crosshair'
        }`}
      >
        {/* Shutter Flash Animation */}
        {flashEffect && (
          <div className="absolute inset-0 bg-white/90 z-30 transition-opacity duration-150 animate-pulse pointer-events-none" />
        )}

        {/* Real-time Mouse Drag Bounding Box Overlay */}
        {isMouseDragging && mouseDragStart && mouseDragCurrent && containerRef.current && (
          <div
            style={{
              left: Math.min(mouseDragStart.clientX, mouseDragCurrent.clientX) - containerRef.current.getBoundingClientRect().left,
              top: Math.min(mouseDragStart.clientY, mouseDragCurrent.clientY) - containerRef.current.getBoundingClientRect().top,
              width: Math.abs(mouseDragCurrent.clientX - mouseDragStart.clientX),
              height: Math.abs(mouseDragCurrent.clientY - mouseDragStart.clientY),
            }}
            className="absolute pointer-events-none border-2 border-dashed border-cyan-400 bg-cyan-500/15 z-30 rounded-lg shadow-2xl flex flex-col justify-between p-1.5 backdrop-blur-[1px]"
          >
            <div className="flex items-center justify-between">
              <span className="bg-slate-950/90 text-cyan-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/50 shadow">
                ROI [{Math.round(Math.abs(mouseDragCurrent.clientX - mouseDragStart.clientX))}x{Math.round(Math.abs(mouseDragCurrent.clientY - mouseDragStart.clientY))}]
              </span>
              <span className="bg-cyan-900/90 text-cyan-100 text-[10px] font-sans px-1.5 py-0.5 rounded">
                Release to Snap ROI
              </span>
            </div>
            <div className="text-[10px] text-cyan-300/80 font-mono text-center bg-slate-950/70 rounded py-0.5">
              Auto-capture armed
            </div>
          </div>
        )}

        {/* Interactive Notice Toast for Mouse ROI Selection */}
        {mouseSelectionNotice && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-slate-950/90 text-cyan-300 border border-cyan-500/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xl flex items-center gap-2 pointer-events-none animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{mouseSelectionNotice}</span>
          </div>
        )}

        {/* 1. Live Video Stream */}
        {feedMode === 'webcam' ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-contain ${isMirrored ? 'scale-x-[-1]' : ''}`}
          />
        ) : feedMode === 'sample' ? (
          /* 2. Preset Sample Feed Image */
          <img
            ref={sampleImgRef}
            src={selectedSample.svgDataUrl}
            alt={selectedSample.name}
            className="w-full h-full object-contain"
          />
        ) : (
          /* 3. Uploaded Document Image */
          <img
            ref={sampleImgRef}
            src={uploadedImageSrc || ''}
            alt="Uploaded Laptop File"
            className="w-full h-full object-contain"
          />
        )}

        {/* 2. Computer Vision Overlay Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 ${
            feedMode === 'webcam' && isMirrored ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* 3. Upright Computer Vision Diagnostics HUD (HTML Overlay - Never Mirror-Flipped) */}
        {settings.showHud && (isCameraActive || feedMode !== 'webcam') && (
          <div className="absolute top-3 left-3 z-20 bg-slate-950/85 backdrop-blur-md rounded-xl p-2.5 border border-slate-700/80 shadow-lg text-[11px] font-mono space-y-1 select-none pointer-events-none">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-1 text-cyan-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>OPENCV CV PIPELINE</span>
            </div>
            <div className="flex items-center justify-between text-slate-300 gap-4">
              <span className="text-slate-400">FPS / Rate:</span>
              <span className={currentFps >= 24 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {currentFps} fps
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300 gap-4">
              <span className="text-slate-400">Hand Detection:</span>
              <span className={detectedHandsCount > 0 ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
                {detectedHandsCount > 0 ? `${detectedHandsCount} (${activeGesture})` : '0 (None)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300 gap-4">
              <span className="text-slate-400">Resolution:</span>
              <span className="text-slate-300">
                {feedMode === 'webcam' ? cameraResolution || 'Detecting...' : '1200x850'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300 gap-4">
              <span className="text-slate-400">AutoCapture:</span>
              <span className={settings.autoCapture ? 'text-emerald-400' : 'text-slate-500'}>
                {settings.autoCapture ? `${settings.holdDurationSeconds}s Hold` : 'Off'}
              </span>
            </div>
          </div>
        )}

        {/* 4. Binary Skin Mask Corner Preview (OpenCV PiP) */}
        {settings.showBinaryMask && binaryMaskUrl && feedMode === 'webcam' && (
          <div className="absolute bottom-4 right-4 z-20 w-36 h-28 bg-black/90 rounded-lg overflow-hidden border border-slate-700 shadow-lg p-1">
            <div className="text-[9px] font-mono text-cyan-400 px-1 pb-1">OpenCV Skin Mask</div>
            <img src={binaryMaskUrl} alt="Skin Mask" className="w-full h-full object-cover rounded" />
          </div>
        )}

        {/* 5. Top Controls Overlay */}
        <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
          {/* Audio Chirp Toggle */}
          <button
            onClick={() => onUpdateSettings({ soundEffects: !settings.soundEffects })}
            title={settings.soundEffects ? 'Shutter audio ON' : 'Shutter audio MUTED'}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg backdrop-blur border border-slate-700/60 transition shadow-sm"
          >
            {settings.soundEffects ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Mirror Flip (Webcam only) */}
          {feedMode === 'webcam' && isCameraActive && (
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              title="Flip / Mirror Camera View"
              className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg backdrop-blur border border-slate-700/60 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Quick ROI Mode Switcher (Hand Gestures vs Mouse Selection) */}
          <div className="hidden sm:flex items-center p-0.5 bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700/60 shadow-sm">
            <button
              onClick={() => onUpdateSettings({ detectionMode: 'pointing' })}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                settings.detectionMode !== 'manual' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Hand Tracking Mode (Index finger pointing or two-hand frame)"
            >
              <Hand className="w-3 h-3" />
              <span>Hand</span>
            </button>
            <button
              onClick={() => {
                onUpdateSettings({ detectionMode: 'manual' });
                cvEngine.resetManualCaptureState();
                setMouseSelectionNotice('Mouse ROI mode: Click & drag anywhere on video/image to set ROI');
                setTimeout(() => setMouseSelectionNotice(null), 3200);
              }}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                settings.detectionMode === 'manual' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Mouse Drag Mode (Draw custom box anywhere on feed)"
            >
              <MousePointer className="w-3 h-3" />
              <span>Mouse</span>
            </button>
          </div>

          {/* Feed Switcher (Webcam | Upload File | Samples) */}
          <div className="flex items-center p-0.5 bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700/60 shadow-sm">
            <button
              id="tab-mode-webcam"
              onClick={() => setFeedMode('webcam')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                feedMode === 'webcam' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Webcam</span>
            </button>

            <button
              id="tab-mode-upload"
              onClick={() => {
                if (!uploadedImageSrc && fileInputRef.current) {
                  fileInputRef.current.click();
                } else {
                  setFeedMode('upload');
                }
              }}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                feedMode === 'upload' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3 h-3" />
              <span>Upload Photo</span>
            </button>

            <button
              id="tab-mode-samples"
              onClick={() => setFeedMode('sample')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                feedMode === 'sample' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileImage className="w-3 h-3" />
              <span>Sample Feeds</span>
            </button>
          </div>
        </div>

        {/* 6. In-Viewport Interactive Troubleshooting / Camera Activation Panel */}
        {feedMode === 'webcam' && (!isCameraActive || cameraError) && (
          <div className="absolute inset-0 bg-slate-950/92 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xs">
            <div className="max-w-md w-full space-y-4">
              {/* Icon */}
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                {isStartingCamera ? (
                  <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
                ) : cameraError ? (
                  <AlertTriangle className="w-7 h-7 text-amber-400" />
                ) : (
                  <Camera className="w-7 h-7 text-cyan-400" />
                )}
              </div>

              {/* Title & Message */}
              <div>
                <h3 className="font-bold text-white text-base">
                  {isStartingCamera
                    ? 'Connecting to Laptop Webcam...'
                    : cameraError
                    ? 'Webcam Input Blocked or Unavailable'
                    : 'Activate Laptop Webcam'}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {cameraError ||
                    'Click below to grant permission and start real-time computer vision hand tracking from your laptop camera.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  id="btn-start-laptop-camera"
                  onClick={() => startCamera()}
                  disabled={isStartingCamera}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-60 flex items-center justify-center space-x-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isStartingCamera ? 'Connecting...' : 'Turn On Laptop Camera'}</span>
                </button>

                {/* Standalone Tab Button (Fixes iframe camera permission blocks) */}
                <button
                  onClick={handleOpenStandalone}
                  title="Open app directly in a new browser tab to bypass iframe permission blocks"
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium rounded-xl border border-slate-700 transition flex items-center justify-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open in Standalone Tab</span>
                </button>
              </div>

              {/* Camera Hardware Selector (If multiple cameras detected) */}
              {availableDevices.length > 1 && (
                <div className="pt-2">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Select Laptop Camera Device:
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {availableDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Fallback Shortcuts */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-center space-x-4 text-xs">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document Image</span>
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={() => setFeedMode('sample')}
                  className="text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Use Sample Feeds</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Bottom Center Big Quick Action Button */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3">
          <button
            id="btn-trigger-capture"
            onClick={() => triggerCapture()}
            className="group flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm rounded-full shadow-xl shadow-emerald-500/30 transition transform active:scale-95 border border-emerald-400/40"
          >
            <Crosshair className="w-4 h-4 animate-spin-slow group-hover:scale-110 transition" />
            <span>Capture Selected ROI</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-emerald-700/50 rounded border border-emerald-400/40 font-mono">
              Space
            </kbd>
          </button>
        </div>
      </div>

      {/* Camera Selection & Device Bar when camera is active */}
      {feedMode === 'webcam' && isCameraActive && availableDevices.length > 1 && (
        <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            Active Camera:
          </span>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 max-w-[240px] truncate"
          >
            {availableDevices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId}>
                {dev.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Preset Feeds Carousel (when sample mode is active) */}
      {feedMode === 'sample' && (
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs font-medium text-slate-300 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileImage className="w-3.5 h-3.5 text-cyan-400" />
              Select Preset Document Feed to Scan:
            </span>
            <span className="text-[11px] text-slate-400">Instant OCR &amp; ROI Verification</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SAMPLE_FEEDS.map((feed) => (
              <button
                key={feed.id}
                onClick={() => setSelectedSample(feed)}
                className={`text-left p-2.5 rounded-lg border text-xs transition ${
                  selectedSample.id === feed.id
                    ? 'bg-cyan-950/60 border-cyan-500/80 text-white shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold truncate text-cyan-300">{feed.name}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{feed.category}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded File Bar (when upload mode is active) */}
      {feedMode === 'upload' && uploadedImageSrc && (
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Custom Laptop Document Loaded</div>
              <div className="text-[11px] text-slate-400">
                You can capture any region of interest using fingertip pointing or the capture button.
              </div>
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 transition"
          >
            Upload Different Photo
          </button>
        </div>
      )}

      {/* Primary Configuration Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-900/70 rounded-xl border border-slate-800 text-white text-xs">
        {/* Detection Mode Selector */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5 flex items-center gap-1">
            <Hand className="w-3.5 h-3.5 text-cyan-400" />
            ROI Detection Mode
          </label>
          <select
            id="select-detection-mode"
            value={settings.detectionMode}
            onChange={(e) => {
              const newMode = e.target.value as DetectionMode;
              onUpdateSettings({ detectionMode: newMode });
              if (newMode === 'manual') {
                cvEngine.resetManualCaptureState();
                setMouseSelectionNotice('Mouse ROI mode: Drag anywhere on the video/image to set region');
                setTimeout(() => setMouseSelectionNotice(null), 3000);
              }
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
          >
            <option value="pointing">👉 Hand: Index Finger Pointing</option>
            <option value="two-hand-frame">👐 Hand: Two-Hand Frame</option>
            <option value="contour">🖐 Hand: OpenCV Skin Contour</option>
            <option value="manual">🖱 Mouse: Custom Drag Selection</option>
          </select>
        </div>

        {/* Auto-Capture Toggle & Trigger Restriction */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Auto-Capture
            </label>
            <button
              id="btn-toggle-autocapture"
              onClick={() => onUpdateSettings({ autoCapture: !settings.autoCapture })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                settings.autoCapture
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {settings.autoCapture ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={settings.autoCaptureTrigger || 'hand_or_mouse'}
              disabled={!settings.autoCapture}
              onChange={(e) =>
                onUpdateSettings({
                  autoCaptureTrigger: e.target.value as any,
                })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
              title="Only capture when region is specified by hand or mouse"
            >
              <option value="hand_or_mouse">🖐 Hand or 🖱 Mouse (Specified)</option>
              <option value="hand_only">🖐 Hand Gestures Only</option>
              <option value="mouse_only">🖱 Mouse Drag Only</option>
            </select>
            <span className="text-[11px] font-mono text-slate-300 whitespace-nowrap">
              {settings.holdDurationSeconds.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* OpenCV Visual Toggles */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Computer Vision Overlays
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onUpdateSettings({ showSkeleton: !settings.showSkeleton })}
              className={`flex-1 py-1 px-2 rounded text-[11px] border transition ${
                settings.showSkeleton
                  ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Skeleton
            </button>
            <button
              onClick={() => onUpdateSettings({ showHud: !settings.showHud })}
              className={`flex-1 py-1 px-2 rounded text-[11px] border transition ${
                settings.showHud
                  ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              HUD Data
            </button>
            <button
              onClick={() => onUpdateSettings({ showBinaryMask: !settings.showBinaryMask })}
              className={`flex-1 py-1 px-2 rounded text-[11px] border transition ${
                settings.showBinaryMask
                  ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Skin Mask
            </button>
          </div>
        </div>

        {/* OCR Preprocessing Toggle */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Image Preprocessing
          </label>
          <button
            onClick={() => onUpdateSettings({ enhanceContrast: !settings.enhanceContrast })}
            className={`w-full py-1.5 px-3 rounded-lg border text-left flex items-center justify-between text-xs transition ${
              settings.enhanceContrast
                ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span>Adaptive Contrast &amp; Binarization</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900">
              {settings.enhanceContrast ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
