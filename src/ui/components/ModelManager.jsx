import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Folder, 
  Search, 
  Plus, 
  FolderOpen, 
  RotateCw, 
  Globe, 
  HardDrive, 
  Check, 
  Eye, 
  Trash2, 
  ExternalLink, 
  Download, 
  Sparkles,
  Layers
} from 'lucide-react';
import ModelDetailsModal from './ModelDetailsModal';

export default function ModelManager() {
  const { 
    localModels, 
    hubModels, 
    config, 
    selectModel, 
    selectMmproj, 
    activateModelBundle,
    deleteModel, 
    openInExplorer, 
    refreshLocalModels, 
    searchHub, 
    openRepoModal,
    downloadInfo,
    cancelDownload 
  } = useApp();

  const [localFilter, setLocalFilter] = useState('');
  const [hubQuery, setHubQuery] = useState('prism-ml');
  const [hubFilterPill, setHubFilterPill] = useState('all');

  // Separate base runnable LLMs from auxiliary vision projectors
  const localBaseModels = useMemo(() => {
    return localModels.filter(m => !m.isMmproj && !m.name.toLowerCase().includes('mmproj'));
  }, [localModels]);

  const localVisionModules = useMemo(() => {
    return localModels.filter(m => m.isMmproj || m.name.toLowerCase().includes('mmproj'));
  }, [localModels]);

  const filteredBaseModels = useMemo(() => {
    return localBaseModels.filter(m => {
      if (!localFilter) return true;
      const q = localFilter.toLowerCase();
      return m.name.toLowerCase().includes(q) || (m.quant && m.quant.toLowerCase().includes(q));
    });
  }, [localBaseModels, localFilter]);

  // Find companion vision module for a given base model
  const findMatchingVision = (model) => {
    if (localVisionModules.length === 0) return null;
    const lowerName = model.name.toLowerCase();

    // 1. If currently configured selectedMmproj is in the list, preserve it for the active model
    if (config.selectedModel === model.path && config.selectedMmproj) {
      const activeVision = localVisionModules.find(v => v.path === config.selectedMmproj);
      if (activeVision) return activeVision;
    }

    // 2. Family match (e.g. bonsai-2-27b, llama-3.2, etc.)
    const baseTokens = lowerName
      .replace(/\.gguf$/, '')
      .split(/[-_.]/)
      .filter(t => t && !['gguf', 'q4', 'q8', 'f16', 'bf16', 'pq2', 'ptq1', '1bit', 'ternary'].includes(t));

    let bestMatch = null;
    let maxScore = 0;
    for (const v of localVisionModules) {
      const vLower = v.name.toLowerCase();
      let score = 0;
      for (const t of baseTokens) {
        if (t.length > 2 && vLower.includes(t)) score++;
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = v;
      }
    }

    if (bestMatch && maxScore > 0) return bestMatch;

    // 3. Fallback: single vision projector in library
    if (localVisionModules.length === 1) return localVisionModules[0];

    return null;
  };

  const totalStorageBytes = localModels.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);
  const totalStorageGb = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

  const handleImportGguf = async () => {
    if (typeof window.tiny === 'undefined') return;
    try {
      const selected = await window.tiny.dialog.openFile({
        title: 'Select GGUF Model File',
        filters: [{ name: 'GGUF Models', extensions: ['gguf', 'mmproj'] }],
      });
      if (selected && selected.length > 0) {
        await selectModel(selected[0]);
      }
    } catch (e) {
      console.log('File picker cancelled or unavailable:', e);
    }
  };

  const handleSearchHub = (e) => {
    e.preventDefault();
    searchHub(hubQuery);
  };

  const handlePillClick = (filter) => {
    setHubFilterPill(filter);
    if (filter === 'all') {
      searchHub('prism-ml');
    } else if (filter === 'bitnet') {
      searchHub('1-bit OR bitnet');
    } else if (filter === 'q4') {
      searchHub('Q4_K_M GGUF');
    } else if (filter === 'deepseek') {
      searchHub('DeepSeek GGUF');
    } else if (filter === 'gemma') {
      searchHub('Gemma GGUF');
    } else if (filter === 'qwen') {
      searchHub('Qwen GGUF');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      
      {/* ACTIVE DOWNLOAD BANNER (Visible on Model Manager) */}
      {downloadInfo && (
        <div className="card bg-zinc-900 border border-sky-500/50 shadow-2xl p-4 ring-1 ring-sky-500/20 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="loading loading-spinner loading-sm text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {downloadInfo.batchTotal > 1
                      ? `Downloading Bundle [Part ${downloadInfo.batchIndex}/${downloadInfo.batchTotal}]`
                      : 'Downloading Model File'}
                  </span>
                  <span className="badge badge-primary badge-xs font-mono font-bold text-black">
                    {downloadInfo.progress || 0}%
                  </span>
                </div>
                <div className="text-xs font-mono text-zinc-300 truncate mt-0.5" title={downloadInfo.filename}>
                  {downloadInfo.filename}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-2xs font-mono text-zinc-400">
                {downloadInfo.meta}
              </span>
              <button
                type="button"
                onClick={cancelDownload}
                className="btn btn-ghost btn-xs text-error hover:bg-error/10 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
          <progress 
            className="progress progress-primary w-full h-2" 
            value={downloadInfo.progress || 0} 
            max="100" 
          />
        </div>
      )}

      {/* SECTION 1: Local GGUF Storage */}
      <section className="space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-base-300">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-base text-white tracking-wide">Local Models</h2>
              <p className="text-xs text-base-content/70 flex items-center gap-1.5 flex-wrap mt-0.5">
                <span>Stored in:</span>
                <span className="font-mono text-primary font-semibold bg-base-300/80 px-2 py-0.5 rounded text-2xs border border-base-300 truncate max-w-sm" title={config.modelsDir || 'models'}>
                  {config.modelsDir || 'models'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="badge badge-neutral gap-2 py-2.5 px-3 font-mono text-xs border border-base-300">
              <HardDrive className="w-3.5 h-3.5 text-primary" />
              <span>{localBaseModels.length} models</span>
              {localVisionModules.length > 0 && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-sky-300 font-semibold">{localVisionModules.length} vision</span>
                </>
              )}
              <span className="opacity-40">·</span>
              <span>{totalStorageGb} GB</span>
            </div>

            <button onClick={handleImportGguf} className="btn btn-primary btn-sm gap-1.5 font-bold shadow-sm">
              <Plus className="w-4 h-4" />
              <span>Import GGUF</span>
            </button>

            <button 
              onClick={() => openInExplorer(config.modelsDir || 'models')} 
              className="btn btn-outline btn-neutral btn-sm gap-1.5"
              title="Open models directory in File Explorer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Folder</span>
            </button>

            <button onClick={refreshLocalModels} className="btn btn-ghost btn-sm btn-square" title="Refresh list">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="max-w-md">
          <label className="input input-bordered input-sm bg-base-200 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
            <input 
              type="text" 
              placeholder="Filter local models by name or quantization..." 
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
              className="grow text-xs"
            />
          </label>
        </div>

        {/* Models Grid (Base Models with Bundled Vision Companions) */}
        {filteredBaseModels.length === 0 ? (
          <div className="card bg-base-200/50 border border-base-300 p-8 text-center space-y-2">
            <p className="text-xs text-base-content/70 font-mono">No local models found matching your search.</p>
            <p className="text-2xs text-base-content/50">
              Place .gguf files inside your models folder or download directly from the Hugging Face hub below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBaseModels.map((m) => {
              const isActive = config.selectedModel === m.path;
              const companionVision = findMatchingVision(m);
              const isVisionActive = Boolean(companionVision && config.selectedMmproj === companionVision.path);

              return (
                <div 
                  key={m.path}
                  className={`card bg-base-200 border transition-all ${
                    isActive ? 'border-primary shadow-xl ring-1 ring-primary/40' : 'border-base-300 hover:border-base-content/20'
                  }`}
                >
                  <div className="card-body p-4 space-y-3">
                    
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-bold text-white truncate" title={m.name}>
                          {m.name}
                        </div>
                        <div className="flex items-center gap-2 text-2xs font-mono text-base-content/60 mt-1">
                          <span>Size: <strong className="text-white">{m.sizeFormatted}</strong></span>
                          {m.maxContext && (
                            <>
                              <span className="opacity-30">·</span>
                              <span className="text-sky-300">{m.maxContext >= 1024 ? `${m.maxContext / 1024}K` : m.maxContext} Ctx</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="badge badge-primary badge-outline badge-xs font-mono font-semibold">
                          {m.quant || 'GGUF'}
                        </span>
                        {isActive && (
                          <span className="badge badge-primary badge-xs font-mono font-bold text-black gap-1">
                            <Check className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bundled Vision Companion Section */}
                    {companionVision && (
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2.5 transition-colors ${
                        isActive && isVisionActive 
                          ? 'bg-sky-500/10 border-sky-500/40' 
                          : 'bg-base-300/50 border-base-300'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Eye className={`w-4 h-4 shrink-0 ${isActive && isVisionActive ? 'text-sky-400' : 'text-zinc-400'}`} />
                          <div className="min-w-0">
                            <div className="text-2xs font-mono font-bold text-zinc-200 flex items-center gap-1.5 truncate">
                              <span className="text-sky-300 font-semibold">Vision Module:</span>
                              <span className="text-white truncate" title={companionVision.name}>{companionVision.name}</span>
                            </div>
                            <div className="text-3xs font-mono text-zinc-400 mt-0.5">
                              Size: {companionVision.sizeFormatted} · Attached Vision Projector
                            </div>
                          </div>
                        </div>

                        {isActive && isVisionActive && (
                          <span className="badge bg-zinc-800 text-sky-400 border border-sky-400/40 badge-xs font-mono font-bold shrink-0">
                            ✓ Vision Active
                          </span>
                        )}
                      </div>
                    )}

                    {/* Unified Actions Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-base-300/60 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs font-bold text-black gap-1 shadow-sm opacity-90 cursor-default"
                            >
                              <Check className="w-3.5 h-3.5 text-black" />
                              <span>{isVisionActive ? 'Active (Model + Vision)' : 'Active Engine'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => activateModelBundle('', '')}
                              className="btn btn-ghost btn-xs text-zinc-400 hover:text-white"
                              title="Deselect active model"
                            >
                              Deselect
                            </button>
                          </div>
                        ) : companionVision ? (
                          <div className="flex items-center gap-1.5">
                            {/* Single Grouped Activation Button */}
                            <button
                              type="button"
                              onClick={() => activateModelBundle(m.path, companionVision.path)}
                              className="btn btn-primary btn-xs font-bold text-black gap-1 shadow-md hover:bg-sky-400 cursor-pointer"
                              title={`Activate ${m.name} paired with vision projector ${companionVision.name}`}
                            >
                              <Sparkles className="w-3 h-3 text-black" />
                              <span>Activate Model + Vision</span>
                            </button>

                            {/* Optional Model Only Button */}
                            <button
                              type="button"
                              onClick={() => activateModelBundle(m.path, '')}
                              className="btn btn-ghost btn-xs text-zinc-400 hover:text-white text-2xs"
                              title="Activate base model without vision module"
                            >
                              Model Only
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => activateModelBundle(m.path, '')}
                            className="btn btn-primary btn-xs font-bold text-black shadow-md cursor-pointer"
                          >
                            <span>Set Active</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openInExplorer(m.path)}
                          className="btn btn-ghost btn-xs text-base-content/70 hover:text-white"
                          title="Reveal in File Explorer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteModel(m.path, m.name)}
                          className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                          title="Delete model file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Installed Vision Projectors Sub-section */}
        {localVisionModules.length > 0 && (
          <div className="mt-6 pt-4 border-t border-base-300 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-mono font-bold text-white tracking-wide uppercase">
                  Installed Vision Projectors ({localVisionModules.length})
                </h3>
              </div>
              <span className="text-2xs font-mono text-zinc-400">
                Automatically bundled with matching models above
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {localVisionModules.map((vp) => (
                <div key={vp.path} className="bg-base-200 border border-base-300 rounded-lg p-3 flex items-center justify-between gap-3 shadow-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-white truncate" title={vp.name}>
                      {vp.name}
                    </div>
                    <div className="text-2xs font-mono text-zinc-400 mt-0.5">
                      Size: {vp.sizeFormatted} · Vision mmproj
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openInExplorer(vp.path)}
                      className="btn btn-ghost btn-2xs text-zinc-400 hover:text-white"
                      title="Reveal in File Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteModel(vp.path, vp.name)}
                      className="btn btn-ghost btn-2xs text-error hover:bg-error/10"
                      title="Delete projector"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </section>

      {/* SECTION 2: Hugging Face Hub Explorer */}
      <section className="space-y-4 pt-4 border-t border-base-300">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-base-300">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-base text-white tracking-wide">Hugging Face Hub</h2>
              <p className="text-xs text-base-content/70">
                Explore, inspect, and download official 1-bit Ternary, BitNet, and quantized GGUF weights.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Preset Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={handleSearchHub} className="flex-1 max-w-lg">
            <label className="input input-bordered input-sm bg-base-200 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
              <input 
                type="text" 
                placeholder="Search Hugging Face models..." 
                value={hubQuery}
                onChange={(e) => setHubQuery(e.target.value)}
                className="grow text-xs"
              />
              <button type="submit" className="btn btn-primary btn-xs font-bold">Search</button>
            </label>
          </form>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Prism' },
              { id: 'bitnet', label: '1-Bit / BitNet' },
              { id: 'q4', label: 'Q4_K_M' },
              { id: 'deepseek', label: 'DeepSeek' },
              { id: 'gemma', label: 'Gemma' },
              { id: 'qwen', label: 'Qwen' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePillClick(p.id)}
                className={`btn btn-xs font-semibold px-2.5 ${
                  hubFilterPill === p.id ? 'btn-primary text-black font-bold' : 'btn-neutral text-base-content/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hub Repos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {hubModels.map((repo) => (
            <div 
              key={repo.id}
              className="card bg-base-200 border border-base-300 hover:border-primary/50 transition-all shadow-md"
            >
              <div className="card-body p-4 space-y-3">
                
                <div>
                  <div className="text-2xs font-mono text-primary font-semibold uppercase tracking-wider">
                    {repo.author || 'Model Repository'}
                  </div>
                  <div className="font-mono text-xs font-bold text-white truncate mt-0.5" title={repo.id}>
                    {repo.id}
                  </div>
                  <div className="text-2xs text-base-content/60 mt-1 line-clamp-2">
                    {repo.description || 'Open-source weights and quantizations on Hugging Face.'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-2xs font-mono text-base-content/60 pt-2 border-t border-base-300/60">
                  <div className="flex items-center gap-3">
                    <span>Downloads: <strong className="text-white">{repo.downloads?.toLocaleString() || 0}</strong></span>
                    <span>Likes: <strong className="text-white">{repo.likes?.toLocaleString() || 0}</strong></span>
                  </div>

                  <button
                    onClick={() => openRepoModal(repo.id)}
                    className="btn btn-outline btn-primary btn-xs gap-1 font-bold"
                  >
                    <Download className="w-3 h-3" />
                    <span>Get Files</span>
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>

      </section>

      {/* Modal for downloading files */}
      <ModelDetailsModal />

    </div>
  );
}
