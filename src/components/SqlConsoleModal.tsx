import React, { useState } from 'react';
import {
  Database,
  Play,
  Download,
  RotateCcw,
  X,
  Code,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
} from 'lucide-react';
import { SqlQueryResult } from '../types';
import { dbService } from '../services/db';

interface SqlConsoleModalProps {
  onClose: () => void;
  onRefreshNotes: () => void;
}

const PRESET_QUERIES = [
  {
    name: 'All Notes by Date',
    sql: 'SELECT id, title, category, confidence, created_at FROM notes ORDER BY created_at DESC;',
  },
  {
    name: 'Group by Category',
    sql: 'SELECT category, COUNT(*) as total FROM notes GROUP BY category;',
  },
  {
    name: 'Table Schema (DESCRIBE)',
    sql: 'DESCRIBE notes;',
  },
  {
    name: 'High Confidence OCR (>95%)',
    sql: 'SELECT id, title, confidence FROM notes WHERE confidence >= 95;',
  },
  {
    name: 'Total Note Count',
    sql: 'SELECT COUNT(*) FROM notes;',
  },
];

export const SqlConsoleModal: React.FC<SqlConsoleModalProps> = ({ onClose, onRefreshNotes }) => {
  const [sql, setSql] = useState<string>(PRESET_QUERIES[0].sql);
  const [result, setResult] = useState<SqlQueryResult | null>(() => dbService.executeSql(PRESET_QUERIES[0].sql));
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const handleRunSql = () => {
    setIsExecuting(true);
    setTimeout(() => {
      const res = dbService.executeSql(sql);
      setResult(res);
      setIsExecuting(false);
      onRefreshNotes();
    }, 50);
  };

  const handleExportDump = () => {
    const dump = dbService.generateSqlDump();
    const blob = new Blob([dump], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handroi_sqlite_backup_${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (confirm('Reset SQLite database to factory sample records?')) {
      dbService.resetToDefaults();
      setResult(dbService.executeSql('SELECT * FROM notes;'));
      onRefreshNotes();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>SQLite / MySQL JDBC Console</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  SQLite 3.42+
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Execute relational queries against the notes schema &amp; export SQL dumps
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-200 text-sm">
          {/* Preset Queries */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              Quick SQL Queries:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSql(q.sql);
                    const res = dbService.executeSql(q.sql);
                    setResult(res);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-mono border border-slate-700 transition"
                >
                  {q.name}
                </button>
              ))}
            </div>
          </div>

          {/* SQL Input Textarea */}
          <div className="relative">
            <textarea
              rows={3}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT * FROM notes WHERE category = 'Computer Vision'..."
              className="w-full bg-slate-950 border border-slate-700/90 rounded-xl p-3 text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-inner resize-none"
            />
            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              <button
                onClick={handleRunSql}
                disabled={isExecuting}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Execute SQL</span>
              </button>
            </div>
          </div>

          {/* Execution Diagnostics */}
          {result && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center space-x-3">
                {result.error ? (
                  <span className="text-red-400 flex items-center gap-1 font-mono">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {result.error}
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {result.rowCount} row(s) returned
                  </span>
                )}
                {result.message && <span className="text-slate-500">{result.message}</span>}
              </div>
              <span className="flex items-center gap-1 font-mono text-slate-500">
                <Clock className="w-3 h-3" />
                {result.executionTimeMs}ms
              </span>
            </div>
          )}

          {/* Results Table */}
          {result && result.columns.length > 0 && (
            <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-950">
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-800/90 text-slate-300 sticky top-0 border-b border-slate-700">
                    <tr>
                      {result.columns.map((col, idx) => (
                        <th key={idx} className="px-3.5 py-2.5 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/80 transition">
                        {result.columns.map((col, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2 whitespace-nowrap">
                            {row[col] !== null && row[col] !== undefined
                              ? String(row[col])
                              : 'NULL'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-slate-400 hover:text-white rounded-lg text-xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo DB</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportDump}
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download .sql Dump</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
