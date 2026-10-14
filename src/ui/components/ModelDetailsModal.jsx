import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Box, 
  Download, 
  X, 
  HardDrive, 
  FileCode, 
  Search, 
  ExternalLink, 
  Check, 
  Layers, 
  Sparkles,
  Eye
} from 'lucide-react';

export default function ModelDetailsModal() {
  const { 
    modalRepo, 
    modalFiles, 
    isModalLoading, 
    closeRepoModal, 
    downloadHfFile, 
    downloadHfBundle,
    localModels,
    downloadInfo,
    cancelDownload,
    openExternalUrl,
    config
  } = useApp();

  const [searchFilter, setSearchFilter] = useState('');
  const [quantFilter, setQuantFilter] = useState('all');

  // Discover vision projector files in this repo
  const visionFiles = useMemo(() => {
    return modalFiles.filter((f) => f.isMmproj || f.filename.toLowerCase().includes('mmproj'));
  }, [modalFiles]);

  // Find the best companion vision projector (prefer BF16 official default, then Q8_0)
  const defaultVisionFile = useMemo(() => {
    if (visionFiles.length === 0) return null;
    const bf16 = visionFiles.find((f) => f.filename.toLowerCase().includes('bf16'));
    if (bf16) return bf16;
    const q8 = visionFiles.find((f) => f.filename.toLowerCase().includes('q8'));
    if (q8) return q8;
    return visionFiles[0];
  }, [visionFiles]);

  const filteredFiles = useMemo(() => {
    return modalFiles.filter((file) => {
      const q = searchFilter.toLowerCase().trim();
      const matchesSearch = !q || 
        file.filename.toLowerCase().includes(q) || 
        (file.quant && file.quant.toLowerCase().includes(q)) ||
        (file.sizeFormatted && file.sizeFormatted.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (quantFilter === '1bit') {
        const lower = file.filename.toLowerCase();
        return lower.includes('q1_0') || lower.includes('1bit') || lower.includes('1-bit') || lower.includes('ptq1');
      }
      if (quantFilter === 'ternary') {
        const lower = file.filename.toLowerCase();
        return lower.includes('pq2') || lower.includes('ternary') || lower.includes('ptq1');
      }
      if (quantFilter === 'q4') {
        const lower = file.filename.toLowerCase();
        return lower.includes('q4') || lower.includes('iq4');
      }
      if (quantFilter === 'vision') {
        return file.isMmproj || file.filename.toLowerCase().includes('mmproj');
      }

      return true;
    });
  }, [modalFiles, searchFilter, quantFilter]);

  if (!modalRepo) return null;

  const hfRepoUrl = `https://huggingface.co/${modalRepo}`;
  const isPrismRepo = modalRepo.toLowerCase().includes('prism') || modalRepo.toLowerCase().includes('bonsai');

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-200 border border-zinc-700 max-w-3xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-700/80 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Box className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white tracking-wide">
                  Repository Quantizations &amp; Sizes
                </h3>
                {isPrismRepo && (
                  <span className="badge badge-primary badge-xs font-mono font-bold text-black gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-black" />
                    Official PrismML
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-zinc-300 truncate max-w-md">
                  {modalRepo}
                </span>
                <button
                  type="button"
                  onClick={() => openExternalUrl(hfRepoUrl)}
                  className="btn btn-ghost btn-xs px-1.5 h-6 text-sky-400 hover:text-sky-300 gap-1"
                  title="View repository on Hugging Face"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="text-2xs font-semibold">HF Hub</span>
                </button>
              </div>
            </div>
          </div>

          <button onClick={closeRepoModal} className="btn btn-ghost btn-sm btn-square text-zinc-400 hover:text-white" title="Close dialog">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar & Vision Matching Banner */}
        {!isModalLoading && modalFiles.length > 0 && (
          <div className="pt-3 pb-2 shrink-0 space-y-2.5">
            
            {/* Active Download Banner inside Modal */}
            {downloadInfo && (
              <div className="bg-zinc-800/90 border border-sky-500/50 rounded-lg p-3 flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="loading loading-spinner loading-sm text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold text-white truncate">
                      Downloading: {downloadInfo.filename}
                    </div>
                    <div className="text-2xs font-mono text-sky-300 font-semibold truncate">
                      {downloadInfo.meta}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="w-24 sm:w-32 shrink-0">
                    <progress className="progress progress-primary w-full h-1.5" value={downloadInfo.progress || 0} max="100" />
                  </div>
                  <button
                    type="button"
                    onClick={cancelDownload}
                    className="btn btn-ghost btn-2xs text-rose-400 hover:text-white hover:bg-rose-500/20 px-2 font-mono gap-1"
                    title="Stop and cancel download"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* Vision Projector Companion Helper Banner (Light Gray & Electric Blue, No Purple) */}
            {defaultVisionFile && (
              <div className="bg-zinc-850 border border-zinc-700 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-md">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="text-2xs font-mono text-zinc-300 leading-relaxed">
                    <strong className="text-white font-bold">Multimodal Vision Available:</strong> Companion projector{' '}
                    <strong className="text-sky-300 font-mono">{defaultVisionFile.filename}</strong>{' '}
                    <span className="text-sky-400 font-bold">({defaultVisionFile.sizeFormatted})</span> detected. Click{' '}
                    <span className="text-white font-bold">&quot;Download + Vision&quot;</span> on any model below to queue both and pair them automatically!
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setQuantFilter(quantFilter === 'vision' ? 'all' : 'vision')}
                  className={`btn btn-2xs font-semibold shrink-0 ${
                    quantFilter === 'vision' 
                      ? 'btn-primary text-black font-bold' 
                      : 'btn-neutral text-zinc-200 border-zinc-700 hover:text-white'
                  }`}
                >
                  {quantFilter === 'vision' ? 'Show All Quants' : `View Projectors (${visionFiles.length})`}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="input input-bordered input-sm bg-zinc-900 border-zinc-700 flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 opacity-50 shrink-0 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter quantizations (e.g. PQ2, Q4_K_M, mmproj)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="grow text-xs text-white"
                />
                {searchFilter && (
                  <button onClick={() => setSearchFilter('')} className="btn btn-ghost btn-2xs btn-circle text-zinc-400">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </label>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All Quants' },
                  { id: 'ternary', label: 'Ternary (PQ2)' },
                  { id: '1bit', label: '1-Bit' },
                  { id: 'q4', label: '4-Bit' },
                  ...(visionFiles.length > 0 ? [{ id: 'vision', label: `Vision (${visionFiles.length})` }] : []),
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setQuantFilter(pill.id)}
                    className={`btn btn-2xs font-semibold px-2 ${
                      quantFilter === pill.id
                        ? 'btn-primary text-black font-bold'
                        : 'btn-neutral text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-2xs font-mono text-zinc-400 px-0.5">
              <span>
                Showing {filteredFiles.length} of {modalFiles.length} files
              </span>
              <span>All sizes verified via Hugging Face repository metadata</span>
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2.5 min-h-0">
          {isModalLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="loading loading-spinner loading-md text-sky-400" />
              <div className="text-center space-y-1">
                <p className="text-xs font-mono font-bold text-white">Retrieving model files &amp; byte sizes...</p>
                <p className="text-2xs font-mono text-zinc-400">Inspecting Hugging Face repository blobs tree</p>
              </div>
            </div>
          ) : modalFiles.length === 0 ? (
            <div className="card bg-zinc-900 border border-zinc-800 p-12 text-center space-y-2 my-4">
              <Layers className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-xs font-mono font-bold text-white">No .gguf or .mmproj model files found</p>
              <p className="text-2xs font-mono text-zinc-400">
                This repository may not host GGUF quantized weights on its main branch.
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="card bg-zinc-900 border border-zinc-800 p-8 text-center space-y-2 my-4">
              <p className="text-xs font-mono text-zinc-300">No files match &quot;{searchFilter}&quot;.</p>
              <button
                onClick={() => { setSearchFilter(''); setQuantFilter('all'); }}
                className="btn btn-ghost btn-xs text-sky-400 font-semibold"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isAlreadyDownloaded = localModels.some(m => m.name === file.filename);
              const isVisionInstalled = defaultVisionFile && localModels.some(m => m.name === defaultVisionFile.filename);
              const isCurrentlyDownloading = Boolean(
                downloadInfo && (
                  downloadInfo.filename === file.filename ||
                  (downloadInfo.parentModelFilename && downloadInfo.parentModelFilename === file.filename)
                )
              );
              const hasMatchingVision = Boolean(!file.isMmproj && defaultVisionFile);

              return (
                <div
                  key={file.path || file.filename}
                  className={`border rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isAlreadyDownloaded
                      ? 'bg-zinc-850/60 border-zinc-750'
                      : 'bg-zinc-850 border-zinc-700 hover:border-sky-500/50'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 shrink-0 text-sky-400" />
                      <span className="text-xs font-mono font-bold text-white truncate" title={file.filename}>
                        {file.filename}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {/* Prominent Size Badge */}
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-750 font-mono text-xs shadow-inner">
                        <span className="text-zinc-400 text-2xs uppercase tracking-wider font-semibold">Size:</span>
                        <strong className="text-sky-400 font-bold">
                          {file.sizeFormatted || '—'}
                        </strong>
                      </div>

                      {/* Quantization Badge */}
                      {file.quant && (
                        <span className="badge badge-primary badge-outline badge-xs font-mono font-semibold">
                          {file.quant}
                        </span>
                      )}

                      {/* Vision Projector Tag */}
                      {file.isMmproj && (
                        <span className="badge bg-zinc-800 text-sky-300 border border-zinc-700 badge-xs font-mono font-semibold">
                          Vision Projector
                        </span>
                      )}

                      {/* Already in library tag */}
                      {isAlreadyDownloaded && (
                        <span className="badge badge-success badge-xs font-mono font-bold text-black gap-1">
                          <Check className="w-2.5 h-2.5" />
                          In Library
                        </span>
                      )}

                      {/* Matching Vision Indicator */}
                      {hasMatchingVision && isVisionInstalled && (
                        <span className="badge bg-zinc-800 text-sky-400 border border-sky-400/40 badge-xs font-mono font-semibold">
                          ✓ Vision Module Ready
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isCurrentlyDownloading ? (
                      <div className="flex flex-col items-end gap-1 px-3 py-2 bg-sky-500/10 border border-sky-500/40 rounded-lg min-w-[220px]">
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-sky-400">
                            <span className="loading loading-spinner loading-xs text-sky-400" />
                            <span>{downloadInfo.progress || 0}%</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-2xs font-mono text-zinc-300">
                              {downloadInfo.speed || '...'}
                            </span>
                            <button
                              type="button"
                              onClick={cancelDownload}
                              className="btn btn-ghost btn-2xs text-rose-400 hover:text-white hover:bg-rose-500/20 px-1.5 h-5 min-h-0 font-mono gap-1"
                              title="Cancel this download"
                            >
                              <X className="w-3 h-3" />
                              <span>Stop</span>
                            </button>
                          </div>
                        </div>
                        <div className="text-2xs font-mono text-zinc-300 w-full text-right truncate" title={downloadInfo.meta}>
                          {downloadInfo.meta || `${downloadInfo.downloadedFormatted} of ${downloadInfo.totalFormatted || file.sizeFormatted}`}
                        </div>
                        <progress 
                          className="progress progress-primary w-full h-1.5 mt-0.5" 
                          value={downloadInfo.progress || 0} 
                          max="100" 
                        />
                      </div>
                    ) : isAlreadyDownloaded ? (
                      <button
                        type="button"
                        onClick={() => downloadHfFile(modalRepo, file.filename, file.downloadUrl, file.sizeBytes)}
                        className="btn btn-ghost btn-xs font-semibold text-zinc-300 hover:text-white"
                        title="Re-download and overwrite local copy"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Re-download</span>
                      </button>
                    ) : hasMatchingVision && !isVisionInstalled ? (
                      <div className="flex items-center gap-2">
                        {/* Download with Vision Bundle (Vibrant Electric Blue & Light Gray, Zero Purple) */}
                        <button
                          type="button"
                          onClick={() => downloadHfBundle(modalRepo, file, defaultVisionFile)}
                          className="btn btn-sm bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-black border-0 gap-1.5 font-bold shadow-md transition-all cursor-pointer"
                          title={`Download ${file.filename} and matching ${defaultVisionFile.filename} (${defaultVisionFile.sizeFormatted}) in one queue`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-black" />
                          <span>Download + Vision</span>
                          <span className="badge bg-black/20 text-black font-mono text-2xs border-0 font-bold">
                            +{defaultVisionFile.sizeFormatted}
                          </span>
                        </button>

                        {/* Download Model Only (Clean Light Gray / Zinc) */}
                        <button
                          type="button"
                          onClick={() => downloadHfFile(modalRepo, file.filename, file.downloadUrl, file.sizeBytes)}
                          className="btn btn-sm bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer"
                          title="Download base model only (without vision projector)"
                        >
                          <span>Model Only</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => downloadHfFile(modalRepo, file.filename, file.downloadUrl, file.sizeBytes)}
                        className="btn btn-sm bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-black border-0 gap-1.5 font-bold shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-black" />
                        <span>{file.isMmproj ? 'Download Projector' : 'Download Model'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-700/80 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="text-2xs font-mono text-zinc-400 flex items-center gap-1.5 truncate max-w-md">
            <HardDrive className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">
              Target folder: <span className="text-white font-semibold">{config.modelsDir || 'models'}</span>
            </span>
          </div>
          <button type="button" onClick={closeRepoModal} className="btn btn-neutral btn-sm px-5 text-zinc-200 border-zinc-700 hover:text-white">
            Close
          </button>
        </div>

      </div>
      <div className="modal-backdrop bg-black/60" onClick={closeRepoModal} />
    </div>
  );
}
