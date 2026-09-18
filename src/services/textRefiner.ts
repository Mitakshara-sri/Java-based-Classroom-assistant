/**
 * Advanced Text Refiner & OCR Post-Processing Engine
 * Author: Mitakshara
 * 
 * Corrects common OCR optical distortions, symbol misrecognitions, broken lines,
 * and sensor noise artifacts to yield clean, digitized text.
 */

export interface TextRefinementResult {
  text: string;
  lines: string[];
  correctionsCount: number;
  qualityScore: number; // 0 - 100%
}

export type OcrPresetMode = 'printed' | 'handwritten' | 'code' | 'numbers';

// Common English words dictionary subset for OCR disambiguation
const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
  'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
  'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'opencv', 'javacv',
  'python', 'java', 'react', 'camera', 'detection', 'image', 'capture', 'system', 'data', 'model',
  'digital', 'notes', 'region', 'text', 'line', 'color', 'pixel', 'code', 'function', 'class',
  'return', 'string', 'number', 'boolean', 'process', 'tracking', 'filter', 'contour', 'bounding',
  'input', 'output', 'state', 'result', 'interface', 'import', 'export', 'const', 'async', 'await'
]);

export class TextRefiner {
  /**
   * Refine and clean OCR transcription based on document type
   */
  public static refine(
    rawText: string,
    preset: OcrPresetMode = 'printed'
  ): TextRefinementResult {
    if (!rawText || rawText.trim().length === 0) {
      return {
        text: '',
        lines: [],
        correctionsCount: 0,
        qualityScore: 0,
      };
    }

    let text = rawText;
    let corrections = 0;

    // 1. Normalize line endings and whitespace
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. Fix hyphenated line breaks (e.g. "algo-\nrithm" -> "algorithm")
    const hyphenMatches = text.match(/([a-zA-Z]{3,})-\n\s*([a-zA-Z]{3,})/g);
    if (hyphenMatches) {
      corrections += hyphenMatches.length;
      text = text.replace(/([a-zA-Z]{3,})-\n\s*([a-zA-Z]{3,})/g, '$1$2');
    }

    // 3. Process line by line
    let lines = text.split('\n');

    // Remove noise lines (lines with only stray punctuation dots/dashes/tildes from paper textures)
    lines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true; // keep paragraph breaks
      // If line consists only of 1-3 punctuation symbols, drop it as camera noise
      if (/^[\.,;:'"`~\^_\-\|/\\]{1,3}$/.test(trimmed)) {
        corrections++;
        return false;
      }
      return true;
    });

    // 4. Word-level character error corrections
    lines = lines.map((line) => {
      if (line.trim().length === 0) return '';

      let words = line.split(/\s+/);
      words = words.map((word) => {
        let cleanedWord = word;

        // Skip URLs or code variables if in code mode
        if (preset === 'code' && (cleanedWord.includes('(') || cleanedWord.includes('.'))) {
          return cleanedWord;
        }

        // Rule A: Replace stray vertical pipes `|` inside letter words (e.g. "He|lo" -> "Hello", "fi|e" -> "file")
        if (/[a-zA-Z]\|[a-zA-Z]/.test(cleanedWord)) {
          cleanedWord = cleanedWord.replace(/([a-zA-Z])\|([a-zA-Z])/g, '$1l$2');
          corrections++;
        }
        if (/^\|[a-zA-Z]/.test(cleanedWord)) {
          cleanedWord = cleanedWord.replace(/^\|([a-zA-Z])/, 'I$1');
          corrections++;
        }

        // Rule B: Disambiguate Zero vs Letter O
        // In words with predominantly letters, digit '0' is usually 'o' or 'O'
        if (/[a-zA-Z]{2,}0[a-zA-Z]*/.test(cleanedWord) || /[a-zA-Z]*0[a-zA-Z]{2,}/.test(cleanedWord)) {
          cleanedWord = cleanedWord.replace(/0/g, 'o');
          corrections++;
        }
        // In pure numeric strings with lone 'O' or 'o', replace with '0'
        if (/\b\d+[Oo]\d*\b/.test(cleanedWord) || /\b[Oo]\d+\b/.test(cleanedWord)) {
          cleanedWord = cleanedWord.replace(/[Oo]/g, '0');
          corrections++;
        }

        // Rule C: Disambiguate '1' vs 'l' / 'I'
        if (/[a-zA-Z]{2,}1[a-zA-Z]+/.test(cleanedWord)) {
          cleanedWord = cleanedWord.replace(/1/g, 'l');
          corrections++;
        }

        // Rule D: Disambiguate '5' vs 'S' in uppercase words (e.g. "SY5TEM" -> "SYSTEM")
        if (/[A-Z]{2,}5[A-Z]*/.test(cleanedWord) || /[A-Z]*5[A-Z]{2,}/.test(cleanedWord)) {
          cleanedWord = cleanedWord.replace(/5/g, 'S');
          corrections++;
        }

        // Rule E: Fix common letter mergers (e.g. 'vv' -> 'w' in English words)
        if (/\bvv[a-z]+/i.test(cleanedWord) && !cleanedWord.toLowerCase().startsWith('vcr')) {
          cleanedWord = cleanedWord.replace(/^vv/i, 'w');
          corrections++;
        }

        // Rule F: Fix 'rn' mistaken for 'm' in known words
        const lower = cleanedWord.toLowerCase().replace(/[^a-z]/g, '');
        if (lower.includes('rn')) {
          const candidate = lower.replace(/rn/g, 'm');
          if (COMMON_WORDS.has(candidate) && !COMMON_WORDS.has(lower)) {
            cleanedWord = cleanedWord.replace(/rn/gi, 'm');
            corrections++;
          }
        }

        // Rule G: Fix 'cl' mistaken for 'd' in known words (e.g. "clata" -> "data")
        if (lower.startsWith('cl')) {
          const candidate = 'd' + lower.substring(2);
          if (COMMON_WORDS.has(candidate) && !COMMON_WORDS.has(lower)) {
            cleanedWord = cleanedWord.replace(/^cl/i, 'd');
            corrections++;
          }
        }

        // Rule H: Strip accidental trailing junk characters from paper margins
        cleanedWord = cleanedWord.replace(/[~`^¤¢§©®]+$/g, '');

        return cleanedWord;
      });

      return words.join(' ');
    });

    // 5. Clean up punctuation spacing (e.g., "word , word" -> "word, word")
    lines = lines.map((line) => {
      return line
        .replace(/\s+([,.:;?!])/g, '$1')
        .replace(/([,.:;?!])([a-zA-Z])/g, '$1 $2')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    });

    // 6. Collapse excessive blank lines into clean paragraph spacing
    const cleanedLines: string[] = [];
    let consecutiveBlanks = 0;
    for (const l of lines) {
      if (l === '') {
        consecutiveBlanks++;
        if (consecutiveBlanks <= 1) cleanedLines.push('');
      } else {
        consecutiveBlanks = 0;
        cleanedLines.push(l);
      }
    }

    const finalText = cleanedLines.join('\n').trim();

    // 7. Calculate quality score based on dictionary match & noise character ratio
    const totalWords = finalText.split(/\s+/).filter(Boolean);
    let validWordCount = 0;
    let symbolCount = 0;

    for (const w of totalWords) {
      const cleanW = w.toLowerCase().replace(/[^a-z]/g, '');
      if (COMMON_WORDS.has(cleanW) || cleanW.length > 2) {
        validWordCount++;
      }
      if (/[~`^_\-|\\]/.test(w)) {
        symbolCount++;
      }
    }

    let qualityScore = 90;
    if (totalWords.length > 0) {
      const dictionaryRatio = validWordCount / totalWords.length;
      const noiseRatio = symbolCount / totalWords.length;
      qualityScore = Math.round(Math.min(99, Math.max(55, dictionaryRatio * 90 - noiseRatio * 30 + 10)));
    }

    return {
      text: finalText,
      lines: cleanedLines.filter((l) => l.length > 0),
      correctionsCount: corrections,
      qualityScore,
    };
  }
}
