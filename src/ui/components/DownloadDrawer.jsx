import React from 'react';
import { useApp } from '../context/AppContext';
import { Download, X } from 'lucide-react';

export default function DownloadDrawer() {
  const { downloadInfo, cancelDownload } = useApp();

  if (!downloadInfo) return null;

  return (
    <div className="fixed bottom-10 right-6 z-50 animate-bounce-in">
      <div className="card bg-base-200 border border-primary/60 shadow-2xl p-4 w-80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-bold text-white">Downloading Model</span>
          </div>
          <button 
            onClick={cancelDownload}
            className="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-error"
            title="Cancel Download"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <div className="text-xs font-mono font-bold text-white truncate" title={downloadInfo.filename}>
            {downloadInfo.filename}
          </div>
          <div className="text-2xs font-mono text-base-content/60 mt-0.5">
            {downloadInfo.meta || 'Connecting...'}
          </div>
        </div>

        <progress 
          className="progress progress-primary w-full" 
          value={downloadInfo.progress || 0} 
          max="100" 
        />
      </div>
    </div>
  );
}
