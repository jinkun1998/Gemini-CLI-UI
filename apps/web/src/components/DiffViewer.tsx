import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  splitView?: boolean;
  filename?: string;
  language?: string;
}

export default function DiffViewer({ oldValue, newValue, splitView = true, filename, language }: DiffViewerProps) {
  const customStyles = {
    variables: {
      dark: {
        diffViewerBackground: '#0f172a',
        diffViewerColor: '#f8fafc',
        addedBackground: '#064e3b',
        addedColor: '#ecfdf5',
        removedBackground: '#7f1d1d',
        removedColor: '#fef2f2',
        wordAddedBackground: '#065f46',
        wordRemovedBackground: '#991b1b',
        addedGutterBackground: '#064e3b',
        removedGutterBackground: '#7f1d1d',
        gutterColor: '#94a3b8',
        codeFoldGutterBackground: '#1e293b',
        codeFoldBackground: '#0f172a',
        emptyLineBackground: '#0f172a',
        lineNumberColor: '#64748b',
        diffViewerTitleBackground: '#1e293b',
        diffViewerTitleColor: '#94a3b8',
        diffViewerTitleBorderColor: '#334155',
      },
      light: {
        diffViewerBackground: '#ffffff',
        diffViewerColor: '#111827',
        addedBackground: '#dcfce7',
        addedColor: '#166534',
        removedBackground: '#fee2e2',
        removedColor: '#991b1b',
        wordAddedBackground: '#bbf7d0',
        wordRemovedBackground: '#fecaca',
        addedGutterBackground: '#dcfce7',
        removedGutterBackground: '#fee2e2',
        lineNumberColor: '#9ca3af',
      }
    }
  };

  const isDark = document.documentElement.classList.contains('theme-dark') || 
                 document.documentElement.classList.contains('theme-gemini') ||
                 document.documentElement.classList.contains('theme-chatgpt') ||
                 document.documentElement.classList.contains('theme-shadcn');

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden my-4 bg-gray-900">
      {filename && (
        <div className="bg-gray-800 px-4 py-2 text-xs font-mono text-gray-400 border-b border-gray-700 flex justify-between items-center">
          <span>{filename}</span>
          {language && <span className="uppercase">{language}</span>}
        </div>
      )}
      <div className="overflow-x-auto max-h-[500px]">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          useDarkTheme={isDark}
          styles={customStyles}
          compareMethod={DiffMethod.WORDS}
          leftTitle="Original"
          rightTitle="Modified"
          showDiffOnly={false}
        />
      </div>
    </div>
  );
}
