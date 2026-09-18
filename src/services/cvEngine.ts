import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { CurrentROI, DetectedHand, DetectionMode, HandRoiSettings, LandmarkPoint } from '../types';

export class CvEngine {
  private handLandmarker: HandLandmarker | null = null;
  private isModelLoading = false;
  private modelLoadError: string | null = null;
  private lastRoiCenter: { x: number; y: number } | null = null;
  private stableStartTime: number | null = null;
  private fpsCounter = 0;
  private lastFpsTime = performance.now();
  private currentFps = 30;
  private capturedManualBoxKey: string | null = null;

  constructor() {
    this.initMediaPipe();
  }

  /**
   * Reset manual capture lock so a new/edited mouse ROI can be auto-captured
   */
  public resetManualCaptureState() {
    this.capturedManualBoxKey = null;
    this.stableStartTime = null;
    this.lastRoiCenter = null;
  }

  private async initMediaPipe() {
    if (this.handLandmarker || this.isModelLoading) return;
    this.isModelLoading = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuErr) {
        console.warn('GPU delegate failed for MediaPipe, retrying with CPU delegate:', gpuErr);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }
      console.log('MediaPipe HandLandmarker initialized successfully');
    } catch (err: any) {
      console.warn('MediaPipe CDN init fallback to OpenCV Canvas mode:', err);
      this.modelLoadError = err?.message || 'Failed to load MediaPipe model';
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Process a single video frame for hand detection and ROI extraction
   */
  public processFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    settings: HandRoiSettings,
    manualRoi?: { x: number; y: number; width: number; height: number },
    onAutoTrigger?: (roi: CurrentROI) => void
  ): {
    hands: DetectedHand[];
    roi: CurrentROI | null;
    fps: number;
    binaryMaskCanvas?: HTMLCanvasElement;
  } {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { hands: [], roi: null, fps: this.currentFps };

    // Update FPS
    this.fpsCounter++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.fpsCounter * 1000) / (now - this.lastFpsTime));
      this.fpsCounter = 0;
      this.lastFpsTime = now;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear overlay canvas
    ctx.clearRect(0, 0, width, height);

    let detectedHands: DetectedHand[] = [];
    let binaryMaskCanvas: HTMLCanvasElement | undefined;

    // 1. Try MediaPipe Hand Landmarker if available
    if (this.handLandmarker && video.readyState >= 2) {
      try {
        const mpResult = this.handLandmarker.detectForVideo(video, now);
        if (mpResult && mpResult.landmarks && mpResult.landmarks.length > 0) {
          const rawHands: DetectedHand[] = mpResult.landmarks.map((landmarks, idx) => {
            const handedness =
              mpResult.handedness && mpResult.handedness[idx] && mpResult.handedness[idx][0]
                ? (mpResult.handedness[idx][0].categoryName as 'Left' | 'Right')
                : 'Unknown';
            const score =
              mpResult.handedness && mpResult.handedness[idx] && mpResult.handedness[idx][0]
                ? mpResult.handedness[idx][0].score
                : 0.85;

            // Convert normalized coordinates [0, 1] to pixel canvas
            const pixelLandmarks: LandmarkPoint[] = landmarks.map((pt) => ({
              x: pt.x * width,
              y: pt.y * height,
              z: pt.z,
            }));

            const gesture = this.classifyGesture(pixelLandmarks);
            const bbox = this.calculateHandBoundingBox(pixelLandmarks);

            return {
              landmarks: pixelLandmarks,
              handedness,
              score,
              bbox,
              gesture,
              tipPoint: pixelLandmarks[8], // Index fingertip
            };
          });

          // Filter out low-confidence detections to prevent phantom hands
          detectedHands = rawHands.filter((h) => h.score >= 0.62);
        }
      } catch (e) {
        // MediaPipe frame execution error
      }
    }

    // 2. OpenCV Skin Contour is ONLY executed if detectionMode is explicitly 'contour'
    // It NEVER runs automatically in 'pointing' or 'two-hand-frame' mode to avoid false positive captures
    if (settings.detectionMode === 'contour' && detectedHands.length === 0) {
      const contourResult = this.runOpenCvSkinContour(video, width, height, settings.showBinaryMask);
      if (contourResult.hand) {
        detectedHands = [contourResult.hand];
      }
      if (contourResult.binaryCanvas) {
        binaryMaskCanvas = contourResult.binaryCanvas;
      }
    } else if (settings.showBinaryMask) {
      // Diagnostic binary mask visualization only (without synthesizing hand)
      const contourResult = this.runOpenCvSkinContour(video, width, height, true);
      if (contourResult.binaryCanvas) {
        binaryMaskCanvas = contourResult.binaryCanvas;
      }
    }

    // 3. Compute Current ROI based on detection mode & detected hands
    let currentRoi: CurrentROI | null = null;

    if (settings.detectionMode === 'manual') {
      if (manualRoi) {
        currentRoi = {
          ...manualRoi,
          confidence: 1.0,
          stableProgress: 0,
          isStable: false,
          source: 'manual',
        };
      }
    } else if (settings.detectionMode === 'two-hand-frame') {
      // Two-hand framing: STRICTLY requires two high-confidence detected hands
      if (detectedHands.length >= 2) {
        const hand1 = detectedHands[0];
        const hand2 = detectedHands[1];
        const tip1 = hand1.landmarks[8] || hand1.tipPoint;
        const tip2 = hand2.landmarks[8] || hand2.tipPoint;
        if (tip1 && tip2 && hand1.score >= 0.65 && hand2.score >= 0.65) {
          const minX = Math.min(tip1.x, tip2.x);
          const minY = Math.min(tip1.y, tip2.y);
          const maxX = Math.max(tip1.x, tip2.x);
          const maxY = Math.max(tip1.y, tip2.y);
          const roiWidth = Math.max(maxX - minX, 100);
          const roiHeight = Math.max(maxY - minY, 60);

          currentRoi = {
            x: Math.max(0, minX),
            y: Math.max(0, minY),
            width: Math.min(width - minX, roiWidth),
            height: Math.min(height - minY, roiHeight),
            confidence: (hand1.score + hand2.score) / 2,
            stableProgress: 0,
            isStable: false,
            source: 'two-hand-frame',
          };
        }
      }
    } else if (settings.detectionMode === 'pointing') {
      // Pointing mode: STRICTLY requires a detected hand pointing with index finger
      if (detectedHands.length > 0) {
        const primaryHand = detectedHands[0];
        const isPointing = this.isIndexPointing(primaryHand.landmarks);

        if (isPointing) {
          primaryHand.gesture = 'pointing';
          const tip = primaryHand.landmarks[8] || primaryHand.tipPoint;

          if (tip) {
            // Document reading window around or just below the pointing fingertip
            const boxWidth = Math.min(width * 0.55, 360);
            const boxHeight = Math.min(height * 0.35, 180);

            let roiX = tip.x - boxWidth / 2;
            let roiY = tip.y + 15; // Just below index tip

            if (roiY + boxHeight > height - 10) {
              roiY = tip.y - boxHeight - 20;
            }
            roiX = Math.max(10, Math.min(roiX, width - boxWidth - 10));
            roiY = Math.max(10, Math.min(roiY, height - boxHeight - 10));

            currentRoi = {
              x: Math.round(roiX),
              y: Math.round(roiY),
              width: Math.round(boxWidth),
              height: Math.round(boxHeight),
              confidence: primaryHand.score,
              stableProgress: 0,
              isStable: false,
              source: 'hand-pointing',
            };
          }
        } else {
          // Hand is in camera view, but not pointing -> no ROI created
          currentRoi = null;
        }
      }
    } else if (settings.detectionMode === 'contour') {
      // Contour mode (explicitly selected): ROI around detected contour tip
      if (detectedHands.length > 0 && detectedHands[0].tipPoint) {
        const tip = detectedHands[0].tipPoint;
        const boxWidth = Math.min(width * 0.55, 360);
        const boxHeight = Math.min(height * 0.35, 180);
        let roiX = Math.max(10, Math.min(tip.x - boxWidth / 2, width - boxWidth - 10));
        let roiY = Math.max(10, Math.min(tip.y + 15, height - boxHeight - 10));

        currentRoi = {
          x: Math.round(roiX),
          y: Math.round(roiY),
          width: Math.round(boxWidth),
          height: Math.round(boxHeight),
          confidence: detectedHands[0].score,
          stableProgress: 0,
          isStable: false,
          source: 'contour',
        };
      }
    }

    // 4. Auto-capture stabilization logic
    // Auto-capture ONLY triggers when region is specified by hand or manually by mouse
    const isHandSource =
      currentRoi &&
      (currentRoi.source === 'hand-pointing' ||
        currentRoi.source === 'two-hand-frame' ||
        currentRoi.source === 'contour');
    const isMouseOrManualSource =
      currentRoi && (currentRoi.source === 'manual' || currentRoi.source === 'mouse');

    const triggerMode = settings.autoCaptureTrigger || 'hand_or_mouse';

    // Verify hand conditions are strictly satisfied for auto-capture
    const isHandConditionSatisfied =
      isHandSource &&
      detectedHands.length > 0 &&
      detectedHands[0].score >= 0.65 &&
      (settings.detectionMode !== 'pointing' || detectedHands[0].gesture === 'pointing') &&
      (settings.detectionMode !== 'two-hand-frame' || detectedHands.length >= 2);

    const isTriggerPermitted =
      settings.autoCapture &&
      currentRoi &&
      ((isHandConditionSatisfied &&
        (triggerMode === 'hand_or_mouse' || triggerMode === 'hand_only')) ||
        (isMouseOrManualSource &&
          manualRoi &&
          (triggerMode === 'hand_or_mouse' || triggerMode === 'mouse_only')));

    if (isTriggerPermitted && currentRoi) {
      const boxKey = `${currentRoi.x},${currentRoi.y},${currentRoi.width},${currentRoi.height}`;
      const isAlreadyCapturedManual = isMouseOrManualSource && this.capturedManualBoxKey === boxKey;

      if (isAlreadyCapturedManual) {
        // Already captured this manual box once; keep visual stability indicator marked
        currentRoi.isStable = true;
        currentRoi.stableProgress = 1.0;
      } else {
        const roiCenterX = currentRoi.x + currentRoi.width / 2;
        const roiCenterY = currentRoi.y + currentRoi.height / 2;

        if (!this.lastRoiCenter) {
          this.lastRoiCenter = { x: roiCenterX, y: roiCenterY };
          this.stableStartTime = now;
        } else {
          const drift = Math.hypot(roiCenterX - this.lastRoiCenter.x, roiCenterY - this.lastRoiCenter.y);
          const maxDrift = 14; // pixels

          if (drift < maxDrift) {
            const holdMs = settings.holdDurationSeconds * 1000;
            const elapsed = now - (this.stableStartTime || now);
            const progress = Math.min(1.0, elapsed / holdMs);
            currentRoi.stableProgress = progress;

            if (progress >= 1.0) {
              currentRoi.isStable = true;
              if (isMouseOrManualSource) {
                this.capturedManualBoxKey = boxKey;
              }
              // Trigger auto-capture
              if (onAutoTrigger) {
                onAutoTrigger(currentRoi);
                // Reset timer for hands so it doesn't repeatedly capture without moving
                this.stableStartTime = now + 1500;
              }
            }
          } else {
            // Hand or box moved, reset stability
            this.lastRoiCenter = { x: roiCenterX, y: roiCenterY };
            this.stableStartTime = now;
            currentRoi.stableProgress = 0;
          }
        }
      }
    } else {
      this.lastRoiCenter = null;
      this.stableStartTime = null;
      if (currentRoi && !isMouseOrManualSource) {
        currentRoi.stableProgress = 0;
        currentRoi.isStable = false;
      }
    }

    // 5. Render overlays on canvas
    if (settings.showSkeleton && detectedHands.length > 0) {
      this.drawHandSkeletons(ctx, detectedHands);
    }

    if (currentRoi) {
      this.drawRoiBox(ctx, currentRoi, settings);
    }

    if (settings.showHud) {
      this.drawCvHud(ctx, width, height, detectedHands, currentRoi, settings);
    }

    return {
      hands: detectedHands,
      roi: currentRoi,
      fps: this.currentFps,
      binaryMaskCanvas,
    };
  }

  /**
   * Classify gesture based on landmark geometric configuration
   */
  private classifyGesture(landmarks: LandmarkPoint[]): DetectedHand['gesture'] {
    if (landmarks.length < 21) return 'none';

    // Key landmark indices:
    // Wrist: 0
    // Thumb: 1,2,3,4
    // Index: 5,6,7,8
    // Middle: 9,10,11,12
    // Ring: 13,14,15,16
    // Pinky: 17,18,19,20

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // Distance to wrist
    const dWrist = (pt: LandmarkPoint) => Math.hypot(pt.x - wrist.x, pt.y - wrist.y);

    const isIndexExtended = dWrist(indexTip) > dWrist(indexPip) * 1.15;
    const isMiddleExtended = dWrist(middleTip) > dWrist(middlePip) * 1.15;
    const isRingExtended = dWrist(ringTip) > dWrist(ringPip) * 1.15;
    const isPinkyExtended = dWrist(pinkyTip) > dWrist(pinkyPip) * 1.15;

    // Check pinch (thumb and index tips close)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    if (pinchDist < 30) {
      return 'pinch';
    }

    // Pointing: only index extended and verified
    if (this.isIndexPointing(landmarks)) {
      return 'pointing';
    }

    // Open Palm: all fingers extended
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return 'open_palm';
    }

    // Fist: none extended
    if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return 'fist';
    }

    return 'framing';
  }

  /**
   * Mathematically checks if index finger is strictly extended in a pointing gesture
   * while other three fingers (middle, ring, pinky) are curled towards palm.
   */
  public isIndexPointing(landmarks: LandmarkPoint[]): boolean {
    if (!landmarks || landmarks.length < 21) return false;

    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const indexPip = landmarks[6];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const dWrist = (pt: LandmarkPoint) => Math.hypot(pt.x - wrist.x, pt.y - wrist.y);

    const dIndexTip = dWrist(indexTip);
    const dIndexPip = dWrist(indexPip);
    const dIndexMcp = dWrist(indexMcp);

    // Index finger must be stretched out: tip must be farther from wrist than PIP and MCP
    const isIndexExtended = dIndexTip > dIndexPip * 1.12 && dIndexTip > dIndexMcp * 1.22;
    if (!isIndexExtended) return false;

    // The other fingers (middle, ring, pinky) should NOT be extended past the index tip
    const dMiddleTip = dWrist(middleTip);
    const dRingTip = dWrist(ringTip);
    const dPinkyTip = dWrist(pinkyTip);

    // Index tip must clearly protrude beyond middle, ring, and pinky tips
    const isProminent =
      dIndexTip > dMiddleTip * 1.05 &&
      dIndexTip > dRingTip * 1.14 &&
      dIndexTip > dPinkyTip * 1.2;

    return isProminent;
  }

  private calculateHandBoundingBox(landmarks: LandmarkPoint[]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    landmarks.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });

    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 10),
      height: Math.max(maxY - minY, 10),
    };
  }

  /**
   * OpenCV-style skin color segmentation and contour convex hull fallback
   */
  private runOpenCvSkinContour(
    video: HTMLVideoElement,
    width: number,
    height: number,
    createDebugCanvas: boolean
  ): { hand?: DetectedHand; binaryCanvas?: HTMLCanvasElement } {
    // Downscale for real-time 30-60 FPS skin segmentation
    const scale = 0.25;
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = sw;
    offscreen.height = sh;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return {};

    offCtx.drawImage(video, 0, 0, sw, sh);
    const imgData = offCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    let minX = sw;
    let minY = sh;
    let maxX = 0;
    let maxY = 0;
    let skinPixelCount = 0;
    let topPoint: { x: number; y: number } = { x: sw / 2, y: sh };

    // YCrCb Skin Color segmentation filter (standard in OpenCV JavaCV skin detection)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // YCrCb conversion
      const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
      const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;

      const isSkin = cr >= 135 && cr <= 175 && cb >= 80 && cb <= 125 && r > g && g > b;

      const px = (i / 4) % sw;
      const py = Math.floor(i / 4 / sw);

      if (isSkin) {
        skinPixelCount++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        if (py < topPoint.y) {
          topPoint = { x: px, y: py };
        }

        if (createDebugCanvas) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        }
      } else if (createDebugCanvas) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }

    let binaryCanvas: HTMLCanvasElement | undefined;
    if (createDebugCanvas) {
      offCtx.putImageData(imgData, 0, 0);
      binaryCanvas = offscreen;
    }

    // Minimum blob size threshold: Require a substantial hand-sized cluster (>= 800 downscaled pixels)
    // and reject if it covers > 50% of the screen (which indicates a wall, wood desk, or floor)
    const totalPixels = sw * sh;
    const blobW = maxX - minX;
    const blobH = maxY - minY;
    const aspect = blobW / Math.max(blobH, 1);

    const isHandLikeBlob =
      skinPixelCount >= 800 &&
      skinPixelCount < totalPixels * 0.5 &&
      blobW >= 28 &&
      blobH >= 28 &&
      aspect >= 0.35 &&
      aspect <= 2.6;

    if (isHandLikeBlob) {
      const invScale = 1 / scale;
      const handBbox = {
        x: minX * invScale,
        y: minY * invScale,
        width: blobW * invScale,
        height: blobH * invScale,
      };

      const tip = {
        x: topPoint.x * invScale,
        y: topPoint.y * invScale,
      };

      return {
        hand: {
          landmarks: [
            { x: handBbox.x + handBbox.width / 2, y: handBbox.y + handBbox.height }, // wrist approx
            tip,
          ],
          handedness: 'Unknown',
          score: 0.72,
          bbox: handBbox,
          gesture: 'pointing',
          tipPoint: tip,
        },
        binaryCanvas,
      };
    }

    return { binaryCanvas };
  }

  /**
   * Draw MediaPipe 21-point skeleton lines and keypoint rings
   */
  private drawHandSkeletons(ctx: CanvasRenderingContext2D, hands: DetectedHand[]) {
    // MediaPipe joint connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17], // Palm base
    ];

    hands.forEach((hand) => {
      const lm = hand.landmarks;
      if (lm.length >= 21) {
        // Draw bones
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)'; // Emerald neon
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        connections.forEach(([i, j]) => {
          if (lm[i] && lm[j]) {
            ctx.moveTo(lm[i].x, lm[i].y);
            ctx.lineTo(lm[j].x, lm[j].y);
          }
        });
        ctx.stroke();

        // Draw joint nodes
        lm.forEach((pt, idx) => {
          ctx.beginPath();
          const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
          ctx.arc(pt.x, pt.y, isTip ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = idx === 8 ? '#f59e0b' : isTip ? '#38bdf8' : '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      } else if (hand.tipPoint) {
        // Draw single tip pointer
        ctx.beginPath();
        ctx.arc(hand.tipPoint.x, hand.tipPoint.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  /**
   * Draw the active Region of Interest (ROI) selection box with corner crosshairs
   */
  private drawRoiBox(ctx: CanvasRenderingContext2D, roi: CurrentROI, settings: HandRoiSettings) {
    const { x, y, width, height, stableProgress, isStable } = roi;

    // Outer subtle glow
    ctx.save();
    ctx.shadowColor = isStable ? '#10b981' : 'rgba(59, 130, 246, 0.4)';
    ctx.shadowBlur = 10;

    // Bounding Box
    ctx.strokeStyle = isStable ? '#10b981' : '#38bdf8'; // emerald when stable, sky blue when framing
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Fill tint
    ctx.fillStyle = isStable ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.05)';
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // Corner brackets (tactical / OpenCV scanner aesthetic)
    const bracketLen = Math.min(24, width * 0.25);
    ctx.strokeStyle = isStable ? '#10b981' : '#0284c7';
    ctx.lineWidth = 3.5;
    ctx.beginPath();

    // Top-Left
    ctx.moveTo(x, y + bracketLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracketLen, y);

    // Top-Right
    ctx.moveTo(x + width - bracketLen, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + bracketLen);

    // Bottom-Left
    ctx.moveTo(x, y + height - bracketLen);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + bracketLen, y + height);

    // Bottom-Right
    ctx.moveTo(x + width - bracketLen, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - bracketLen);

    ctx.stroke();

    // Crosshair in center
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // Dimension & Tag badge above ROI
    ctx.font = '11px "Fira Code", monospace';
    const sourceLabel =
      roi.source === 'manual' || roi.source === 'mouse'
        ? 'MOUSE ROI'
        : roi.source === 'hand-pointing'
        ? 'HAND POINTING'
        : roi.source === 'two-hand-frame'
        ? 'TWO-HAND FRAME'
        : roi.source.toUpperCase();
    const tagText = `ROI [${width}x${height}] • ${sourceLabel}`;
    const textMetrics = ctx.measureText(tagText);
    const badgeWidth = textMetrics.width + 16;
    const badgeHeight = 20;
    const badgeX = x;
    const badgeY = Math.max(0, y - badgeHeight - 4);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
    ctx.fillStyle = isStable ? '#34d399' : '#e2e8f0';
    ctx.fillText(tagText, badgeX + 8, badgeY + 14);

    // Auto-capture Circular Stability Countdown Ring
    if (settings.autoCapture && stableProgress > 0) {
      const ringRadius = 14;
      const ringX = x + width - 20;
      const ringY = Math.max(20, y - 14);

      const isManual = roi.source === 'manual' || roi.source === 'mouse';
      const isAlreadySaved = isManual && this.capturedManualBoxKey === `${x},${y},${width},${height}`;

      // Background ring
      ctx.beginPath();
      ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Progress arc
      ctx.beginPath();
      ctx.arc(
        ringX,
        ringY,
        ringRadius,
        -Math.PI / 2,
        -Math.PI / 2 + stableProgress * Math.PI * 2
      );
      ctx.strokeStyle = isAlreadySaved ? '#059669' : stableProgress >= 1 ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner icon or countdown text
      ctx.fillStyle = '#ffffff';
      ctx.font = isAlreadySaved ? '8px sans-serif' : '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        isAlreadySaved ? 'SAVED' : stableProgress >= 1 ? 'SNAP' : `${Math.round(stableProgress * 100)}%`,
        ringX,
        ringY
      );
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  /**
   * Draw diagnostic OpenCV Computer Vision HUD
   */
  private drawCvHud(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    hands: DetectedHand[],
    roi: CurrentROI | null,
    settings: HandRoiSettings
  ) {
    const hudWidth = 210;
    const hudHeight = 94;
    const x = 12;
    const y = 12;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(x, y, hudWidth, hudHeight);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, hudWidth, hudHeight);

    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('OPENCV CV PIPELINE', x + 10, y + 16);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`FPS: `, x + 10, y + 34);
    ctx.fillStyle = this.currentFps >= 25 ? '#34d399' : '#f87171';
    ctx.fillText(`${this.currentFps} fps`, x + 55, y + 34);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Hands: `, x + 10, y + 49);
    ctx.fillStyle = hands.length > 0 ? '#ffffff' : '#64748b';
    ctx.fillText(
      hands.length > 0 ? `${hands.length} (${hands[0].gesture})` : '0 (None detected)',
      x + 55,
      y + 49
    );

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Mode: `, x + 10, y + 64);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${settings.detectionMode}`, x + 55, y + 64);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`AutoSnap: `, x + 10, y + 79);
    ctx.fillStyle = settings.autoCapture ? '#34d399' : '#94a3b8';
    ctx.fillText(
      settings.autoCapture ? `ON (${settings.holdDurationSeconds}s hold)` : 'OFF (Manual)',
      x + 65,
      y + 79
    );
  }

  /**
   * Crop the selected ROI rectangle from the video frame into an ultra-clean high-DPI image canvas
   */
  public captureRoiImage(
    video: HTMLVideoElement,
    roi: CurrentROI
  ): { roiCanvas: HTMLCanvasElement; fullCanvas: HTMLCanvasElement } {
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    // Full Frame Canvas
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = videoWidth;
    fullCanvas.height = videoHeight;
    const fullCtx = fullCanvas.getContext('2d');
    if (fullCtx) {
      fullCtx.imageSmoothingEnabled = true;
      fullCtx.imageSmoothingQuality = 'high';
      fullCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    }

    // Clamp ROI coordinates to safe video bounds
    const safeX = Math.max(0, Math.min(videoWidth - 10, Math.round(roi.x)));
    const safeY = Math.max(0, Math.min(videoHeight - 10, Math.round(roi.y)));
    const safeW = Math.max(20, Math.min(videoWidth - safeX, Math.round(roi.width)));
    const safeH = Math.max(20, Math.min(videoHeight - safeY, Math.round(roi.height)));

    // Upscale factor for high-resolution text preservation (target width >= 900px)
    const scale = safeW < 900 ? Math.min(3.0, 960 / safeW) : 1.0;
    const outW = Math.round(safeW * scale);
    const outH = Math.round(safeH * scale);

    // Cropped ROI Canvas with high-definition rendering
    const roiCanvas = document.createElement('canvas');
    roiCanvas.width = outW;
    roiCanvas.height = outH;
    const roiCtx = roiCanvas.getContext('2d');
    if (roiCtx) {
      roiCtx.imageSmoothingEnabled = true;
      roiCtx.imageSmoothingQuality = 'high';
      roiCtx.drawImage(
        video,
        safeX,
        safeY,
        safeW,
        safeH,
        0,
        0,
        outW,
        outH
      );
    }

    return { roiCanvas, fullCanvas };
  }
}

export const cvEngine = new CvEngine();
