import React, { useState } from 'react';
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
    deleteModel, 
    openInExplorer, 
    refreshLocalModels, 
    searchHub, 
    openRepoModal 
  } = useApp();

  const [localFilter, setLocalFilter] = useState('');
  const [hubQuery, setHubQuery] = useState('prism-ml');
  const [hubFilterPill, setHubFilterPill] = useState('all');

  const filteredLocal = localModels.filter(m => {
    if (!localFilter) return true;
    const q = localFilter.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.quant && m.quant.toLowerCase().includes(q));
  });

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
      
      {/* SECTION 1: Local GGUF Storage */}
      <section className="space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-base-300">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-base text-white tracking-wide">Local Models</h2>
              <p className="text-xs text-base-content/70">
                GGUF weights and vision projection adapters stored on disk.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="badge badge-neutral gap-2 py-2.5 px-3 font-mono text-xs border border-base-300">
              <HardDrive className="w-3.5 h-3.5 text-primary" />
              <span>{localModels.length} models</span>
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

        {/* Models Grid */}
        {filteredLocal.length === 0 ? (
          <div className="card bg-base-200/50 border border-base-300 p-8 text-center space-y-2">
            <p className="text-xs text-base-content/70 font-mono">No local models found matching your search.</p>
            <p className="text-2xs text-base-content/50">
              Place .gguf files inside your models folder or download directly from the Hugging Face hub below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLocal.map((m) => {
              const isActive = config.selectedModel === m.path;
              const isMmproj = config.selectedMmproj === m.path;
              const isVisionFile = m.name.toLowerCase().includes('mmproj');

              return (
                <div 
                  key={m.path}
                  className={`card bg-base-200 border transition-all ${
                    isActive ? 'border-primary shadow-lg ring-1 ring-primary/40' : 'border-base-300 hover:border-base-content/20'
                  }`}
                >
                  <div className="card-body p-4 space-y-3">
                    
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-bold text-white truncate" title={m.name}>
                          {m.name}
                        </div>
                        <div className="text-2xs font-mono text-base-content/60 mt-0.5">
                          Size: <strong className="text-white">{m.sizeFormatted}</strong>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="badge badge-primary badge-outline badge-xs font-mono">
                          {m.quant || 'GGUF'}
                        </span>
                        {isActive && (
                          <span className="badge badge-primary badge-xs font-mono font-bold text-black gap-1">
                            <Check className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                        {isMmproj && (
                          <span className="badge badge-secondary badge-xs font-mono text-white gap-1">
                            <Eye className="w-2.5 h-2.5" />
                            Vision
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-base-300/60">
                      <div className="flex items-center gap-1.5">
                        {!isActive && (
                          <button
                            onClick={() => selectModel(m.path)}
                            className="btn btn-primary btn-xs font-semibold"
                          >
                            Set Active
                          </button>
                        )}

                        {isVisionFile && !isMmproj && (
                          <button
                            onClick={() => selectMmproj(m.path)}
                            className="btn btn-secondary btn-xs font-semibold"
                          >
                            Set Vision
                          </button>
                        )}

                        <button
                          onClick={() => openInExplorer(m.path)}
                          className="btn btn-ghost btn-xs text-base-content/70 hover:text-white"
                          title="Reveal in File Explorer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      </div>

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
              );
            })}
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
