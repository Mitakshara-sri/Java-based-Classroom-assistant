/**
 * PDF & Text Export Service
 * Author: Mitakshara
 */

import { jsPDF } from 'jspdf';
import { Note } from '../types';

export class ExportService {
  /**
   * Export a single note as a beautifully styled PDF document
   */
  public static exportNoteToPdf(note: Note): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;

    // 1. Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('HandROI Digitized Note Document', margin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('OpenCV / JavaCV Hand Detection & Tess4J OCR Engine', margin, 21);

    cursorY = 38;

    // 2. Note Title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(note.title, contentWidth);
    doc.text(titleLines, margin, cursorY);
    cursorY += titleLines.length * 8 + 4;

    // 3. Metadata Bar (Date, Category, Confidence)
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, cursorY, contentWidth, 12, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    const formattedDate = new Date(note.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.text(`Created: ${formattedDate}`, margin + 5, cursorY + 7.5);
    doc.text(`Category: ${note.category}`, margin + 65, cursorY + 7.5);
    doc.text(`OCR Confidence: ${note.confidence.toFixed(1)}%`, margin + 115, cursorY + 7.5);

    cursorY += 20;

    // 4. Captured ROI Image Snapshot
    if (note.roiImageDataUrl) {
      try {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text('Captured Region of Interest (ROI Snapshot):', margin, cursorY);
        cursorY += 6;

        // Image container with subtle border
        const imgMaxHeight = 55;
        const imgMaxWidth = contentWidth;
        const imgX = margin;
        const imgY = cursorY;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(imgX, imgY, imgMaxWidth, imgMaxHeight, 2, 2, 'FD');

        // Center the image inside the container
        const imgProps = doc.getImageProperties(note.roiImageDataUrl);
        const imgAspect = imgProps.width / imgProps.height;
        let renderWidth = imgMaxWidth - 6;
        let renderHeight = renderWidth / imgAspect;

        if (renderHeight > imgMaxHeight - 6) {
          renderHeight = imgMaxHeight - 6;
          renderWidth = renderHeight * imgAspect;
        }

        const renderX = imgX + (imgMaxWidth - renderWidth) / 2;
        const renderY = imgY + (imgMaxHeight - renderHeight) / 2;

        doc.addImage(note.roiImageDataUrl, 'PNG', renderX, renderY, renderWidth, renderHeight);

        cursorY += imgMaxHeight + 12;
      } catch (err) {
        console.warn('PDF image inclusion error:', err);
      }
    }

    // 5. Digitized Text Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Digitized OCR Content:', margin, cursorY);
    cursorY += 7;

    // Content box
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    const splitContent = doc.splitTextToSize(note.content, contentWidth - 8);
    const contentBoxHeight = splitContent.length * 5.2 + 8;

    // Check if we need a new page
    if (cursorY + contentBoxHeight > pageHeight - 25) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, contentBoxHeight, 2, 2, 'FD');

    doc.text(splitContent, margin + 4, cursorY + 6);
    cursorY += contentBoxHeight + 12;

    // 6. Tags
    if (note.tags && note.tags.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Tags: ${note.tags.map((t) => '#' + t).join('  ')}`, margin, cursorY);
    }

    // 7. Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Exported via HandROI Note Digitizer • SQLite DB Record ID: ${note.id}`,
      margin,
      pageHeight - 10
    );

    const safeTitle = note.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    doc.save(`${safeTitle || 'note'}_digitized.pdf`);
  }

  /**
   * Export all notes into a combined PDF document
   */
  public static exportAllToPdf(notes: Note[]): void {
    if (notes.length === 0) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    notes.forEach((note, index) => {
      if (index > 0) doc.addPage();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`HandROI Note Collection (${index + 1} of ${notes.length})`, margin, 14);

      let y = 34;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(note.title, margin, y);

      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Category: ${note.category} | Created: ${new Date(note.createdAt).toLocaleDateString()} | Accuracy: ${note.confidence.toFixed(1)}%`,
        margin,
        y
      );

      y += 12;
      doc.setFont('courier', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      const splitText = doc.splitTextToSize(note.content, pageWidth - margin * 2);
      doc.text(splitText, margin, y);
    });

    doc.save('handroi_all_notes_collection.pdf');
  }

  /**
   * Export note as a plain text file (.txt)
   */
  public static exportNoteToTxt(note: Note): void {
    const divider = '='.repeat(60);
    const content = [
      divider,
      `TITLE: ${note.title}`,
      `DATE: ${new Date(note.createdAt).toLocaleString()}`,
      `CATEGORY: ${note.category}`,
      `OCR CONFIDENCE: ${note.confidence.toFixed(1)}%`,
      `TAGS: ${note.tags.join(', ')}`,
      `RECORD ID: ${note.id}`,
      divider,
      '',
      note.content,
      '',
      divider,
      'Exported from HandROI Note Digitizer',
      divider,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = note.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    a.download = `${safeTitle || 'note'}_digitized.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export note as Markdown (.md)
   */
  public static exportNoteToMarkdown(note: Note): void {
    const content = [
      '---',
      `title: "${note.title}"`,
      `date: ${note.createdAt}`,
      `category: ${note.category}`,
      `confidence: ${note.confidence.toFixed(1)}%`,
      `tags: [${note.tags.map((t) => `"${t}"`).join(', ')}]`,
      `id: "${note.id}"`,
      '---',
      '',
      `# ${note.title}`,
      '',
      `*Digitized on ${new Date(note.createdAt).toLocaleDateString()} with ${note.confidence.toFixed(1)}% OCR accuracy*`,
      '',
      '## Transcribed Content',
      '',
      '```',
      note.content,
      '```',
      '',
      '---',
      '*Captured via HandROI Computer Vision & Tess4J Engine*',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = note.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    a.download = `${safeTitle || 'note'}_digitized.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
