import { useState, useMemo } from 'react';
import { parseDiff, Diff, Hunk, ViewType } from 'react-diff-view';
import { createPatch } from 'diff';
import { Columns, Rows, Check, X } from 'lucide-react';
import 'react-diff-view/style/index.css';

interface DiffViewerProps {
  oldValue?: string;
  newValue?: string;
  diffText?: string;
  filename?: string;
  language?: string;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export default function DiffViewer({ oldValue, newValue, diffText, filename, language, onAccept, onReject, showActions = false }: DiffViewerProps) {
  const [viewType, setViewType] = useState<ViewType>('split');

  const files = useMemo(() => {
    let text = diffText;
    if (!text && oldValue !== undefined && newValue !== undefined) {
      text = createPatch(filename || 'file', oldValue, newValue);
    }
    
    if (text && !text.startsWith('---') && !text.startsWith('diff ')) {
      const fn = filename || 'file';
      text = `--- a/${fn}\n+++ b/${fn}\n@@ -1,1 +1,1 @@\n${text}`;
    }
    
    try {
      return text ? parseDiff(text) : [];
    } catch (e) {
      console.error('Failed to parse diff', e);
      return [];
    }
  }, [oldValue, newValue, diffText, filename]);

  const isDark = document.documentElement.classList.contains('dark');

  const header = (
    <div className="bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--foreground)] border-b border-[var(--border)] flex justify-between items-center">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gray-500 font-mono text-xs shrink-0">File:</span>
        <span className="font-mono text-blue-400 truncate">{filename || (files.length > 0 ? files[0].newPath : 'file')}</span>
        {language && (
          <span className="ml-2 px-1.5 py-0.5 bg-[var(--background)] rounded text-[10px] uppercase text-gray-400 tracking-wider shrink-0">
            {language}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 bg-[var(--background)] rounded-lg p-1 border border-[var(--border)] shrink-0 ml-4">
        <button 
          onClick={() => setViewType('split')}
          className={`p-1.5 rounded-md transition-all ${viewType === 'split' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          title="Side-by-side View"
        >
          <Columns className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setViewType('unified')}
          className={`p-1.5 rounded-md transition-all ${viewType === 'unified' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          title="Unified View"
        >
          <Rows className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const actions = showActions && (
    <div className="bg-[var(--surface)] p-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
      <button 
        onClick={onReject}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all border border-transparent hover:border-red-900/50"
      >
        <X className="w-4 h-4" /> Reject changes
      </button>
      <button 
        onClick={onAccept}
        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-500 rounded-lg transition-all shadow-lg shadow-green-900/20 active:scale-95"
      >
        <Check className="w-4 h-4" /> Accept changes
      </button>
    </div>
  );

  return (
    <div className={`flex flex-col border border-[var(--border)] rounded-[var(--radius)] overflow-hidden my-4 bg-[var(--background)] shadow-2xl w-full min-w-0 ${isDark ? 'diff-dark' : ''}`}>
      {header}

      <div className="overflow-auto max-h-[60vh] scrollbar-thin w-full diff-container">
        {files.length > 0 ? (
          <div className="min-w-fit">
            {files.map((file, i) => (
              <Diff key={i} viewType={viewType} diffType={file.type} hunks={file.hunks}>
                {(hunks: any[]) => hunks.map((hunk: any) => <Hunk key={hunk.content} hunk={hunk} />)}
              </Diff>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 italic">
            Visual diff not available for this format.
          </div>
        )}
      </div>

      {actions}

      <style>{`
        .diff-container .diff {
          font-family: 'JetBrains Mono', Menlo, Monaco, Consolas, monospace;
          font-size: 13px;
        }
        .diff-dark .diff-table {
          background-color: transparent;
          color: #e2e8f0;
        }
        .diff-dark .diff-hunk-header {
          background-color: #1e293b;
          color: #94a3b8;
        }
        .diff-dark .diff-gutter {
          background-color: #0f172a;
          color: #475569;
          border-right: 1px solid #1e293b;
        }
        .diff-dark .diff-gutter-normal {
          background-color: transparent;
        }
        .diff-dark .diff-gutter-insert {
          background-color: #064e3b;
          color: #10b981;
        }
        .diff-dark .diff-gutter-delete {
          background-color: #7f1d1d;
          color: #ef4444;
        }
        .diff-dark .diff-code-insert {
          background-color: #064e3b44;
        }
        .diff-dark .diff-code-delete {
          background-color: #7f1d1d44;
        }
        .diff-dark .diff-code-edit {
          background-color: transparent;
        }
        .diff-dark .diff-line-hover .diff-code {
          background-color: #1e293b;
        }
        .diff-table {
          width: 100%;
          border-collapse: collapse;
        }
      `}</style>
    </div>
  );
}
