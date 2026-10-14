import React from 'react';
import { useApp } from '../context/AppContext';
import { Box, Download, X, HardDrive, FileCode } from 'lucide-react';

export default function ModelDetailsModal() {
  const { modalRepo, modalFiles, isModalLoading, closeRepoModal, downloadHfFile } = useApp();

  if (!modalRepo) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-200 border border-base-300 max-w-2xl max-h-[80vh] flex flex-col p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-2.5">
            <Box className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm text-white">Repository Quantizations</h3>
              <div className="text-xs font-mono text-base-content/70 truncate max-w-md">
                {modalRepo}
              </div>
            </div>
          </div>
          <button onClick={closeRepoModal} className="btn btn-ghost btn-sm btn-square">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2 min-h-0">
          {isModalLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="loading loading-spinner loading-md text-primary" />
              <span className="text-xs font-mono text-base-content/60">Fetching repository tree...</span>
            </div>
          ) : modalFiles.length === 0 ? (
            <div className="text-center py-12 text-xs font-mono text-base-content/60">
              No .gguf model files discovered in this repository.
            </div>
          ) : (
            modalFiles.map((file) => (
              <div
                key={file.path || file.filename}
                className="bg-base-300/40 border border-base-300 p-3 rounded-lg flex items-center justify-between gap-3 hover:border-primary/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-mono font-bold text-white truncate">
                      {file.filename}
                    </span>
                  </div>
                  <div className="text-2xs font-mono text-base-content/60 mt-1 flex items-center gap-3">
                    <span>Size: <strong className="text-white">{file.sizeFormatted || '—'}</strong></span>
                    {file.quant && (
                      <span className="badge badge-primary badge-outline badge-xs">{file.quant}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => downloadHfFile(modalRepo, file.filename, file.downloadUrl)}
                  className="btn btn-primary btn-sm gap-1.5 font-bold shadow-sm shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-base-300 flex justify-between items-center shrink-0">
          <div className="text-2xs font-mono text-base-content/60 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-primary" />
            <span>Files will be saved directly into your configured models folder.</span>
          </div>
          <button onClick={closeRepoModal} className="btn btn-neutral btn-sm">
            Close
          </button>
        </div>

      </div>
      <div className="modal-backdrop bg-black/60" onClick={closeRepoModal} />
    </div>
  );
}
