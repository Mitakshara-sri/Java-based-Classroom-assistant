/**
 * SQLite & Local Storage Notes Database Service
 * Author: Mitakshara
 */

import { Note, SqlQueryResult } from '../types';

const DB_KEY = 'handroi_notes_db_v1';

// Seed sample notes
const DEFAULT_NOTES: Note[] = [
  {
    id: 'note-001',
    title: 'Computer Vision & Optical Flow Notes',
    content: 'Lucas-Kanade method assumes brightness constancy and small motion between consecutive frames.\n\nKey formula:\nIx * u + Iy * v + It = 0\n\nWhere u and v are horizontal and vertical optical flow velocities.',
    roiImageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="10" y="10" width="380" height="200" rx="8" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><text x="30" y="50" font-family="monospace" font-size="16" font-weight="bold" fill="%230f172a">Lucas-Kanade Method</text><text x="30" y="85" font-family="monospace" font-size="14" fill="%23334155">Ix * u + Iy * v + It = 0</text><text x="30" y="125" font-family="sans-serif" font-size="13" fill="%2364748b">Brightness constancy constraint</text><text x="30" y="155" font-family="sans-serif" font-size="13" fill="%2364748b">Frame gradient spatial matrix A^T * A</text><circle cx="350" cy="40" r="16" fill="%2310b981" opacity="0.2"/><path d="M344 40l4 4 8-8" stroke="%2310b981" stroke-width="2.5" fill="none"/></svg>',
    confidence: 96.4,
    category: 'Computer Vision',
    tags: ['OpenCV', 'Algorithms', 'Optics'],
    wordCount: 34,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    roiBox: { x: 120, y: 150, width: 400, height: 220 }
  },
  {
    id: 'note-002',
    title: 'Java 17 JDBC SQLite Architecture Pattern',
    content: 'try (Connection conn = DriverManager.getConnection("jdbc:sqlite:notes.db");\n     PreparedStatement stmt = conn.prepareStatement(\n        "INSERT INTO notes (title, content) VALUES (?, ?)")) {\n    stmt.setString(1, note.getTitle());\n    stmt.setString(2, note.getContent());\n    stmt.executeUpdate();\n}',
    roiImageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240"><rect width="100%" height="100%" fill="%23f1f5f9"/><rect x="10" y="10" width="400" height="220" rx="8" fill="%231e293b"/><text x="30" y="50" font-family="monospace" font-size="13" fill="%2338bdf8">try (Connection conn = DriverManager...)</text><text x="45" y="85" font-family="monospace" font-size="13" fill="%23f8fafc">PreparedStatement stmt = conn...</text><text x="45" y="120" font-family="monospace" font-size="13" fill="%23a7f3d0">stmt.setString(1, note.getTitle());</text><text x="45" y="155" font-family="monospace" font-size="13" fill="%23facc15">stmt.executeUpdate();</text></svg>',
    confidence: 98.2,
    category: 'Backend Architecture',
    tags: ['Java', 'JDBC', 'SQLite'],
    wordCount: 41,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    roiBox: { x: 80, y: 110, width: 420, height: 240 }
  }
];

class DatabaseService {
  private notes: Note[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(DB_KEY);
      if (stored) {
        this.notes = JSON.parse(stored);
      } else {
        this.notes = [...DEFAULT_NOTES];
        this.persist();
      }
    } catch {
      this.notes = [...DEFAULT_NOTES];
    }
  }

  private persist() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.notes));
    } catch (e) {
      console.warn('LocalStorage save failed (storage full or disabled):', e);
    }
  }

  public getAllNotes(): Note[] {
    return [...this.notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getNoteById(id: string): Note | undefined {
    return this.notes.find((n) => n.id === id);
  }

  public saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
    const newNote: Note = {
      ...note,
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.notes.unshift(newNote);
    this.persist();
    return newNote;
  }

  public updateNote(id: string, updates: Partial<Note>): Note | null {
    const index = this.notes.findIndex((n) => n.id === id);
    if (index === -1) return null;

    this.notes[index] = {
      ...this.notes[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.notes[index];
  }

  public deleteNote(id: string): boolean {
    const initialLen = this.notes.length;
    this.notes = this.notes.filter((n) => n.id !== id);
    if (this.notes.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  public searchNotes(query: string, category?: string): Note[] {
    const q = query.toLowerCase().trim();
    return this.notes.filter((n) => {
      const matchesCategory = !category || category === 'All' || n.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }

  public getCategories(): string[] {
    const categories = new Set(this.notes.map((n) => n.category || 'General'));
    return Array.from(categories);
  }

  /**
   * Execute raw SQL statements against the SQLite database representation
   */
  public executeSql(sql: string): SqlQueryResult {
    const startTime = performance.now();
    const cleanSql = sql.trim().replace(/;+$/, '');

    try {
      if (!cleanSql) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: 0,
          error: 'Empty SQL statement provided.',
        };
      }

      // 1. DESCRIBE / PRAGMA TABLE_INFO
      if (/^(describe|pragma table_info)\s+notes/i.test(cleanSql)) {
        const columns = ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'];
        const rows = [
          { cid: 0, name: 'id', type: 'VARCHAR(64)', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'title', type: 'VARCHAR(255)', notnull: 1, dflt_value: null, pk: 0 },
          { cid: 2, name: 'content', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
          { cid: 3, name: 'confidence', type: 'DECIMAL(5,2)', notnull: 0, dflt_value: 0.0, pk: 0 },
          { cid: 4, name: 'category', type: 'VARCHAR(64)', notnull: 0, dflt_value: "'General'", pk: 0 },
          { cid: 5, name: 'tags', type: 'VARCHAR(255)', notnull: 0, dflt_value: "''", pk: 0 },
          { cid: 6, name: 'word_count', type: 'INTEGER', notnull: 0, dflt_value: 0, pk: 0 },
          { cid: 7, name: 'created_at', type: 'DATETIME', notnull: 1, dflt_value: 'CURRENT_TIMESTAMP', pk: 0 },
          { cid: 8, name: 'updated_at', type: 'DATETIME', notnull: 1, dflt_value: 'CURRENT_TIMESTAMP', pk: 0 },
        ];
        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: Math.round(performance.now() - startTime),
          message: 'Schema returned successfully.',
        };
      }

      // 2. SELECT
      if (/^select/i.test(cleanSql)) {
        // Special case: COUNT(*)
        if (/select\s+count\(\*\)\s+(as\s+\w+\s+)?from\s+notes/i.test(cleanSql)) {
          const rows = [{ 'COUNT(*)': this.notes.length }];
          return {
            columns: ['COUNT(*)'],
            rows,
            rowCount: 1,
            executionTimeMs: Math.round(performance.now() - startTime),
          };
        }

        // Group by category
        if (/group\s+by\s+category/i.test(cleanSql)) {
          const counts: Record<string, number> = {};
          this.notes.forEach((n) => {
            const cat = n.category || 'General';
            counts[cat] = (counts[cat] || 0) + 1;
          });
          const rows = Object.entries(counts).map(([category, count]) => ({
            category,
            total: count,
          }));
          return {
            columns: ['category', 'total'],
            rows,
            rowCount: rows.length,
            executionTimeMs: Math.round(performance.now() - startTime),
          };
        }

        // General select
        let filtered = [...this.notes];

        // Basic WHERE category = '...'
        const catMatch = cleanSql.match(/where\s+category\s*=\s*['"]([^'"]+)['"]/i);
        if (catMatch) {
          filtered = filtered.filter((n) => n.category.toLowerCase() === catMatch[1].toLowerCase());
        }

        // Basic WHERE confidence > ...
        const confMatch = cleanSql.match(/where\s+confidence\s*([><=]+)\s*(\d+(?:\.\d+)?)/i);
        if (confMatch) {
          const op = confMatch[1];
          const val = parseFloat(confMatch[2]);
          filtered = filtered.filter((n) => {
            if (op === '>') return n.confidence > val;
            if (op === '>=') return n.confidence >= val;
            if (op === '<') return n.confidence < val;
            if (op === '<=') return n.confidence <= val;
            return n.confidence === val;
          });
        }

        // LIMIT
        const limitMatch = cleanSql.match(/limit\s+(\d+)/i);
        if (limitMatch) {
          const limit = parseInt(limitMatch[1], 10);
          filtered = filtered.slice(0, limit);
        }

        // Determine columns
        const colMatch = cleanSql.match(/^select\s+(.+?)\s+from/i);
        let columns = ['id', 'title', 'category', 'confidence', 'wordCount', 'createdAt'];

        if (colMatch && colMatch[1].trim() !== '*') {
          columns = colMatch[1]
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
        }

        const rows = filtered.map((n) => {
          const row: Record<string, any> = {};
          columns.forEach((col) => {
            const key = col.toLowerCase();
            if (key === 'id') row[col] = n.id;
            else if (key === 'title') row[col] = n.title;
            else if (key === 'content') row[col] = n.content.substring(0, 60) + '...';
            else if (key === 'category') row[col] = n.category;
            else if (key === 'confidence') row[col] = `${n.confidence.toFixed(1)}%`;
            else if (key === 'tags') row[col] = n.tags.join(', ');
            else if (key === 'word_count' || key === 'wordcount') row[col] = n.wordCount;
            else if (key === 'created_at' || key === 'createdat') row[col] = n.createdAt.split('T')[0];
            else row[col] = (n as any)[col] ?? null;
          });
          return row;
        });

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: Math.round(performance.now() - startTime),
        };
      }

      // 3. DELETE
      if (/^delete\s+from\s+notes/i.test(cleanSql)) {
        const idMatch = cleanSql.match(/where\s+id\s*=\s*['"]([^'"]+)['"]/i);
        if (idMatch) {
          const success = this.deleteNote(idMatch[1]);
          return {
            columns: ['status', 'affected_rows'],
            rows: [{ status: success ? 'SUCCESS' : 'NOT_FOUND', affected_rows: success ? 1 : 0 }],
            rowCount: success ? 1 : 0,
            executionTimeMs: Math.round(performance.now() - startTime),
            message: `1 row deleted.`,
          };
        }
      }

      // Fallback
      return {
        columns: ['query_status'],
        rows: [{ query_status: 'EXECUTED', sql: cleanSql }],
        rowCount: 1,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: 'Statement executed against local SQLite JDBC simulation engine.',
      };
    } catch (err: any) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: Math.round(performance.now() - startTime),
        error: err?.message || 'SQL Syntax error',
      };
    }
  }

  /**
   * Export the database as a SQL dump file content
   */
  public generateSqlDump(): string {
    const lines: string[] = [
      '-- HandROI Note Digitizer - SQLite / MySQL Database Dump',
      `-- Generated on: ${new Date().toISOString()}`,
      '-- Schema Version: 1.0.0',
      '',
      'DROP TABLE IF EXISTS notes;',
      '',
      'CREATE TABLE notes (',
      '    id VARCHAR(64) PRIMARY KEY,',
      '    title VARCHAR(255) NOT NULL,',
      '    content TEXT NOT NULL,',
      '    confidence DECIMAL(5,2) DEFAULT 0.00,',
      "    category VARCHAR(64) DEFAULT 'General',",
      "    tags VARCHAR(255) DEFAULT '',",
      '    word_count INTEGER DEFAULT 0,',
      '    roi_box_json TEXT,',
      '    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,',
      '    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
      ');',
      '',
    ];

    this.notes.forEach((note) => {
      const escape = (str: string) => str.replace(/'/g, "''");
      lines.push(
        `INSERT INTO notes (id, title, content, confidence, category, tags, word_count, roi_box_json, created_at, updated_at) VALUES (` +
          `'${escape(note.id)}', ` +
          `'${escape(note.title)}', ` +
          `'${escape(note.content)}', ` +
          `${note.confidence.toFixed(2)}, ` +
          `'${escape(note.category)}', ` +
          `'${escape(note.tags.join(','))}', ` +
          `${note.wordCount}, ` +
          `'${JSON.stringify(note.roiBox)}', ` +
          `'${note.createdAt}', ` +
          `'${note.updatedAt}'` +
          `);`
      );
    });

    lines.push('', '-- End of SQL dump');
    return lines.join('\n');
  }

  public resetToDefaults() {
    this.notes = [...DEFAULT_NOTES];
    this.persist();
  }
}

export const dbService = new DatabaseService();
