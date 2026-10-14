import React from 'react';
import { useApp } from '../context/AppContext';
import { Download, X, Sparkles } from 'lucide-react';

export default function DownloadDrawer() {
  const { downloadInfo, cancelDownload } = useApp();

  if (!downloadInfo) return null;

  const isBatch = downloadInfo.batchTotal > 1;

  return (
    <div className="fixed bottom-10 right-6 z-50 animate-bounce-in">
      <div className="card bg-base-200 border border-primary/60 shadow-2xl p-4 w-88 space-y-3 ring-1 ring-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isBatch ? (
              <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
            ) : (
              <Download className="w-4 h-4 text-sky-400 animate-pulse" />
            )}
            <span className="text-xs font-bold text-white">
              {isBatch ? 'Downloading Bundle' : 'Downloading File'}
            </span>
            {isBatch && (
              <span className="badge bg-zinc-800 border border-zinc-700 text-sky-300 badge-xs font-mono font-bold">
                Part {downloadInfo.batchIndex} of {downloadInfo.batchTotal}
              </span>
            )}
          </div>
          <button 
            onClick={cancelDownload}
            className="btn btn-ghost btn-xs btn-square text-zinc-400 hover:text-error"
            title="Cancel Download"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <div className="text-xs font-mono font-bold text-white truncate" title={downloadInfo.filename}>
            {downloadInfo.filename}
          </div>
          <div className="text-2xs font-mono text-zinc-300 mt-0.5">
            {downloadInfo.meta || 'Connecting...'}
          </div>
        </div>

        <progress 
          className="progress progress-primary w-full h-1.5" 
          value={downloadInfo.progress || 0} 
          max="100" 
        />
      </div>
    </div>
  );
}
