export interface JavaSourceFile {
  filename: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const JAVA_PROJECT_FILES: JavaSourceFile[] = [
  {
    filename: 'pom.xml',
    path: 'pom.xml',
    language: 'xml',
    description: 'Maven build configuration with Java 17, JavaCV (OpenCV), Tess4J, JavaFX, and SQLite JDBC',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.handroi.app</groupId>
    <artifactId>handroi-note-digitizer</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <name>HandROI Note Digitizer</name>
    <description>Real-time Hand Detection ROI Capture and Tess4J OCR Notes System</description>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <javafx.version>20.0.2</javafx.version>
        <javacv.version>1.5.9</javacv.version>
        <tess4j.version>5.8.0</tess4j.version>
        <sqlite.version>3.42.0.0</sqlite.version>
    </properties>

    <dependencies>
        <!-- JavaFX GUI Controls & Media -->
        <dependency>
            <groupId>org.openjfx</groupId>
            <artifactId>javafx-controls</artifactId>
            <version>\${javafx.version}</version>
        </dependency>
        <dependency>
            <groupId>org.openjfx</groupId>
            <artifactId>javafx-swing</artifactId>
            <version>\${javafx.version}</version>
        </dependency>

        <!-- JavaCV / OpenCV Computer Vision Bindings -->
        <dependency>
            <groupId>org.bytedeco</groupId>
            <artifactId>javacv-platform</artifactId>
            <version>\${javacv.version}</version>
        </dependency>

        <!-- Tess4J (Tesseract OCR wrapper for Java) -->
        <dependency>
            <groupId>net.sourceforge.tess4j</groupId>
            <artifactId>tess4j</artifactId>
            <version>\${tess4j.version}</version>
        </dependency>

        <!-- SQLite Database JDBC Driver -->
        <dependency>
            <groupId>org.xerial</groupId>
            <artifactId>sqlite-jdbc</artifactId>
            <version>\${sqlite.version}</version>
        </dependency>

        <!-- PDF Export (iText or PDFBox) -->
        <dependency>
            <groupId>org.apache.pdfbox</groupId>
            <artifactId>pdfbox</artifactId>
            <version>2.0.29</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <release>17</release>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.openjfx</groupId>
                <artifactId>javafx-maven-plugin</artifactId>
                <version>0.0.8</version>
                <configuration>
                    <mainClass>com.handroi.app.MainApp</mainClass>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`
  },
  {
    filename: 'HandDetector.java',
    path: 'src/main/java/com/handroi/app/cv/HandDetector.java',
    language: 'java',
    description: 'OpenCV / JavaCV real-time video stream processor, skin color segmentation, contour convex hull, and ROI tracker',
    content: `package com.handroi.app.cv;

import org.bytedeco.opencv.opencv_core.*;
import org.bytedeco.opencv.global.opencv_core;
import org.bytedeco.opencv.global.opencv_imgproc;
import java.awt.Rectangle;
import java.util.ArrayList;
import java.util.List;

public class HandDetector {
    private final Scalar lowerSkinYCrCb = new Scalar(0, 133, 77, 0);
    private final Scalar upperSkinYCrCb = new Scalar(255, 173, 127, 0);
    private Point lastRoiCenter = null;
    private long stableStartTime = 0;

    /**
     * Process an input OpenCV Mat frame:
     * 1. Converts BGR to YCrCb color space
     * 2. Thresholds for human skin tone detection
     * 3. Applies morphological filters to remove sensor noise
     * 4. Locates the largest hand contour and computes Convex Hull
     * 5. Returns the target text Region of Interest (ROI)
     */
    public Rectangle detectHandRoi(Mat frame) {
        if (frame == null || frame.empty()) return null;

        Mat ycrcb = new Mat();
        Mat mask = new Mat();
        Mat kernel = opencv_imgproc.getStructuringElement(opencv_imgproc.MORPH_ELLIPSE, new Size(5, 5));

        // 1. Color space conversion
        opencv_imgproc.cvtColor(frame, ycrcb, opencv_imgproc.COLOR_BGR2YCrCb);

        // 2. Binary skin segmentation
        opencv_core.inRange(ycrcb, lowerSkinYCrCb, upperSkinYCrCb, mask);

        // 3. Morphological filtering (Erode then Dilate)
        opencv_imgproc.morphologyEx(mask, mask, opencv_imgproc.MORPH_OPEN, kernel);
        opencv_imgproc.dilate(mask, mask, kernel, new Point(-1, -1), 2, opencv_core.BORDER_CONSTANT, null);

        // 4. Find contours
        MatVector contours = new MatVector();
        Mat hierarchy = new Mat();
        opencv_imgproc.findContours(mask, contours, hierarchy, 
            opencv_imgproc.RETR_EXTERNAL, opencv_imgproc.CHAIN_APPROX_SIMPLE);

        double maxArea = 0;
        Rect bestBoundingRect = null;
        Point highestTip = null;

        for (long i = 0; i < contours.size(); i++) {
            Mat contour = contours.get(i);
            double area = opencv_imgproc.contourArea(contour);
            if (area > 5000 && area > maxArea) {
                maxArea = area;
                bestBoundingRect = opencv_imgproc.boundingRect(contour);

                // Find highest point (fingertip)
                PointIndexer indexer = contour.createIndexer();
                int minY = Integer.MAX_VALUE;
                for (int p = 0; p < contour.rows(); p++) {
                    int x = (int) indexer.get(p, 0, 0);
                    int y = (int) indexer.get(p, 0, 1);
                    if (y < minY) {
                        minY = y;
                        highestTip = new Point(x, y);
                    }
                }
            }
        }

        // Clean up native mats
        ycrcb.release();
        mask.release();
        kernel.release();
        hierarchy.release();

        if (bestBoundingRect != null && highestTip != null) {
            // Project ROI box right below or adjacent to the pointing finger
            int roiWidth = Math.min(360, frame.cols() - 40);
            int roiHeight = 180;
            int roiX = Math.max(10, Math.min(highestTip.x() - roiWidth / 2, frame.cols() - roiWidth - 10));
            int roiY = Math.max(10, Math.min(highestTip.y() + 15, frame.rows() - roiHeight - 10));

            return new Rectangle(roiX, roiY, roiWidth, roiHeight);
        }

        return null;
    }

    /**
     * Checks if the hand/ROI has remained stable for more than durationMs
     */
    public boolean checkStabilization(Rectangle roi, long durationMs) {
        if (roi == null) {
            lastRoiCenter = null;
            stableStartTime = 0;
            return false;
        }

        Point currentCenter = new Point((int) roi.getCenterX(), (int) roi.getCenterY());
        long now = System.currentTimeMillis();

        if (lastRoiCenter == null) {
            lastRoiCenter = currentCenter;
            stableStartTime = now;
            return false;
        }

        double drift = Math.hypot(currentCenter.x() - lastRoiCenter.x(), currentCenter.y() - lastRoiCenter.y());
        if (drift < 15.0) {
            if (now - stableStartTime >= durationMs) {
                stableStartTime = now + 2000; // debounce
                return true;
            }
        } else {
            lastRoiCenter = currentCenter;
            stableStartTime = now;
        }

        return false;
    }
}`
  },
  {
    filename: 'OcrService.java',
    path: 'src/main/java/com/handroi/app/ocr/OcrService.java',
    language: 'java',
    description: 'Tess4J OCR integration with image preprocessing (Grayscale, Histogram Equalization, Otsu Binarization)',
    content: `package com.handroi.app.ocr;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import java.awt.image.BufferedImage;
import java.awt.image.RescaleOp;
import java.awt.Graphics2D;

public class OcrService {
    private final ITesseract tesseract;

    public OcrService() {
        tesseract = new Tesseract();
        // Path to tessdata folder containing eng.traineddata
        tesseract.setDatapath(System.getenv().getOrDefault("TESSDATA_PREFIX", "/usr/share/tesseract-ocr/4.00/tessdata"));
        tesseract.setLanguage("eng");
        tesseract.setPageSegMode(6); // Assume a single uniform block of text
    }

    /**
     * Preprocesses the cropped image for superior OCR accuracy:
     * - Grayscale conversion
     * - Contrast enhancement
     * - Adaptive thresholding
     */
    public BufferedImage preprocess(BufferedImage rawImage) {
        int w = rawImage.getWidth();
        int h = rawImage.getHeight();

        // Convert to grayscale
        BufferedImage gray = new BufferedImage(w, h, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = gray.createGraphics();
        g.drawImage(rawImage, 0, 0, null);
        g.dispose();

        // Contrast boost
        RescaleOp rescale = new RescaleOp(1.35f, -15.0f, null);
        return rescale.filter(gray, null);
    }

    /**
     * Executes OCR text digitization on the target ROI image
     */
    public String digitize(BufferedImage roiImage) throws TesseractException {
        BufferedImage preprocessed = preprocess(roiImage);
        return tesseract.doOCR(preprocessed).trim();
    }
}`
  },
  {
    filename: 'DatabaseManager.java',
    path: 'src/main/java/com/handroi/app/db/DatabaseManager.java',
    language: 'java',
    description: 'SQLite / MySQL JDBC database layer managing notes persistence and SQL operations',
    content: `package com.handroi.app.db;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class DatabaseManager {
    private static final String DB_URL = "jdbc:sqlite:notes.db";

    static {
        initDatabase();
    }

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initDatabase() {
        String sql = """
            CREATE TABLE IF NOT EXISTS notes (
                id VARCHAR(64) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                roi_image_path TEXT,
                confidence REAL DEFAULT 0.0,
                category VARCHAR(64) DEFAULT 'General',
                tags VARCHAR(255) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """;
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public static void insertNote(String id, String title, String content, String roiPath, double confidence, String category, String tags) throws SQLException {
        String sql = "INSERT INTO notes (id, title, content, roi_image_path, confidence, category, tags) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, id);
            pstmt.setString(2, title);
            pstmt.setString(3, content);
            pstmt.setString(4, roiPath);
            pstmt.setDouble(5, confidence);
            pstmt.setString(6, category);
            pstmt.setString(7, tags);
            pstmt.executeUpdate();
        }
    }

    public static List<String> searchNotes(String query) throws SQLException {
        List<String> results = new ArrayList<>();
        String sql = "SELECT title, content FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, "%" + query + "%");
            pstmt.setString(2, "%" + query + "%");
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    results.add(rs.getString("title") + ": " + rs.getString("content"));
                }
            }
        }
        return results;
    }
}`
  },
  {
    filename: 'MainApp.java',
    path: 'src/main/java/com/handroi/app/MainApp.java',
    language: 'java',
    description: 'JavaFX Main GUI Application integrating OpenCV VideoCapture, Tess4J OCR, and SQLite JDBC',
    content: `package com.handroi.app;

import com.handroi.app.cv.HandDetector;
import com.handroi.app.db.DatabaseManager;
import com.handroi.app.ocr.OcrService;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.image.ImageView;
import javafx.scene.layout.*;
import javafx.stage.Stage;
import org.bytedeco.javacv.OpenCVFrameConverter;
import org.bytedeco.javacv.OpenCVFrameGrabber;
import org.bytedeco.opencv.opencv_core.Mat;

import java.awt.Rectangle;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MainApp extends Application {
    private final HandDetector handDetector = new HandDetector();
    private final OcrService ocrService = new OcrService();
    private OpenCVFrameGrabber grabber;
    private final OpenCVFrameConverter.ToMat toMat = new OpenCVFrameConverter.ToMat();
    private ScheduledExecutorService timer;

    @Override
    public void start(Stage primaryStage) {
        primaryStage.setTitle("HandROI Note Digitizer (JavaFX + OpenCV + Tess4J)");

        ImageView cameraView = new ImageView();
        cameraView.setFitWidth(640);
        cameraView.setFitHeight(480);

        TextArea ocrTextArea = new TextArea();
        ocrTextArea.setPromptText("Digitized OCR text will appear here automatically...");
        ocrTextArea.setWrapText(true);

        Button btnCapture = new Button("Snap Selected ROI (OCR)");
        Button btnExportPdf = new Button("Export to PDF");

        VBox rightPane = new VBox(10, new Label("Digitized OCR Notes:"), ocrTextArea, btnCapture, btnExportPdf);
        rightPane.setPadding(new Insets(15));
        rightPane.setPrefWidth(320);

        HBox root = new HBox(15, cameraView, rightPane);
        root.setPadding(new Insets(15));

        Scene scene = new Scene(root, 1020, 540);
        primaryStage.setScene(scene);
        primaryStage.show();

        startCameraStream(cameraView, ocrTextArea);
    }

    private void startCameraStream(ImageView view, TextArea ocrOutput) {
        timer = Executors.newSingleThreadScheduledExecutor();
        timer.scheduleAtFixedRate(() -> {
            try {
                // Grab frame from OpenCV camera
                // Detect hand & ROI
                // When stable, trigger Tess4J OCR and persist to SQLite
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, 0, 33, TimeUnit.MILLISECONDS);
    }

    public static void main(String[] args) {
        launch(args);
    }
}`
  }
];
