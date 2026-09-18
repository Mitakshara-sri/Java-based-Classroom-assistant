HandROI Note Digitizer

An intelligent desktop web application that leverages real-time Computer Vision (CV) to detect human hand gestures (index finger pointing or two-hand framing), dynamically crops a Region of Interest (ROI) over physical documents, books, or screens, enhances image legibility through a custom preprocessing pipeline, and digitizes the text using deep neural network OCR with SQLite database persistence.

---

Key Features

1. **Real-Time Hand Gesture ROI Detection**
   - **Pointing Mode (`isIndexPointing`)**: Tracks 21 hand landmarks and calculates Euclidean distances from the wrist to verify true index finger extension and prominence over curled fingers.
   - **Two-Hand Frame Mode**: Uses dual hand positions to bound a rectangular bounding box across larger pages or whiteboards.
   - **Mouse ROI Fallback**: Interactive click-and-drag selection directly across the camera canvas for manual precision.
   - **Stabilization & Auto-Capture**: Auto-triggers a high-resolution snapshot only after the hand/ROI remains stationary for a configurable duration (default 1.2s), preventing blurry captures.

2. **Ultra High-DPI Computer Vision Preprocessing Pipeline**
   - **Super-Resolution Bicubic Scaling**: Upscales cropped regions to ensure font x-heights exceed 35px for optimal OCR character contour recognition.
   - **Ambient Illumination & Shadow Flattening**: Normalizes low-frequency gradients and removes harsh desk or laptop lid shadows.
   - **Laplacian Edge Sharpening**: Boosts stroke boundary contrast without introducing noisy grain.
   - **Dynamic Otsu & Sauvola Binarization**: Adaptive local thresholding tuned specifically for varying document lighting conditions.
   - **Automatic Projection-Profile Deskewing**: Calculates horizontal ink variance across angles (-12° to +12°) to straighten tilted paper.

3. **Intelligent Text Refiner & Correction**
   - Contextual character disambiguation (`0` vs `O`, `1` vs `l`/`I`, `5` vs `S`, `8` vs `B`).
   - Line break and hyphenation repair.
   - Punctuation noise stripping and dictionary word cleaning.

4. **Structured Note Storage & Multi-Format Export**
   - In-browser SQLite persistence engine supporting live SQL queries, category filters, and tags.
   - One-click PDF generation with embedded high-resolution ROI snapshots and metadata.
   - Plaintext (.txt) export and clipboard copying.

5. **Cross-Platform Architecture (Web + Java 17 Companion)**
   - High-performance TypeScript + React 19 + Vite frontend.
   - Complete reference implementation in Java 17 using OpenCV/JavaCV (`HandDetector.java`), Tess4J (`OcrProcessor.java`), JavaFX GUI, and SQLite JDBC (`DatabaseManager.java`).

---

Tech Stack

- **Frontend & UI:** React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Computer Vision:** MediaPipe HandLandmarker, HTML5 Canvas 2D Image Processing
- **OCR Engine:** Tesseract.js (LSTM neural network models)
- **PDF Generation:** jsPDF
- **Build System:** Vite, ESBuild

---

Getting Started

 Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn

 Installation

```bash
# Clone the repository
git clone https://github.com/mitakshara/handroi-note-digitizer.git
cd handroi-note-digitizer

# Install dependencies
npm install

# Start the local development server
npm run dev
```

 Building for Production

```bash
npm run build
```

---

How It Works

1. **Start the Camera:** Grant camera permissions to start the 1080p video feed.
2. **Select Region of Interest:** Point your index finger at a line of text, or drag your mouse across any document.
3. **Capture:** Hold still for 1.2 seconds for auto-capture, or press the **Spacebar**.
4. **Review & Enhance:** In the review modal, adjust contrast, inspect the Sauvola binary mask, or rotate if needed.
5. **Save to Database:** Save your digitized note with tags and category into SQLite.
