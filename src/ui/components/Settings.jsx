import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Settings as SettingsIcon, 
  Terminal, 
  Download, 
  FolderOpen, 
  Save, 
  RotateCw, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Sparkles,
  Cpu,
  Layers,
  Zap,
  Check,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function Settings() {
  const { config, saveConfig, systemInfo } = useApp();

  const [form, setForm] = useState({
    host: config.host || '127.0.0.1',
    port: config.port || 8080,
    ctxSize: config.ctxSize || 8192,
    nGl: config.nGl ?? 0,
    threads: config.threads || 8,
    batchSize: config.batchSize || 512,
    uBatchSize: config.uBatchSize || 512,
    modelsDir: config.modelsDir || 'models',
    extraArgs: config.extraArgs || '',
  });

  const [releases, setReleases] = useState(null);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [installingAsset, setInstallingAsset] = useState(null);
  const [installProgress, setInstallProgress] = useState(null);
  const [binaryStatus, setBinaryStatus] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  // Hardware Analysis
  const gpus = systemInfo?.gpus || [];
  const primaryGpu = gpus.find(g => /nvidia|geforce|rtx|gtx/i.test(g.Name || '')) ||
                     gpus.find(g => /radeon|amd/i.test(g.Name || '')) ||
                     gpus[0];
  const gpuName = primaryGpu ? (primaryGpu.Name || '') : null;
  const isNvidia = gpuName && /nvidia|geforce|rtx|gtx/i.test(gpuName);
  const isAmd = gpuName && /radeon|amd/i.test(gpuName);

  useEffect(() => {
    setForm({
      host: config.host || '127.0.0.1',
      port: config.port || 8080,
      ctxSize: config.ctxSize || 8192,
      nGl: config.nGl ?? 0,
      threads: config.threads || 8,
      batchSize: config.batchSize || 512,
      uBatchSize: config.uBatchSize || 512,
      modelsDir: config.modelsDir || 'models',
      extraArgs: config.extraArgs || '',
    });
  }, [config]);

  // Check current binary verification status
  const checkCurrentBinary = async () => {
    if (typeof window.tiny === 'undefined') return;
    try {
      const res = await window.tiny.api.call('checkBinaryStatus', { binaryPath: config.binaryPath });
      setBinaryStatus(res);
    } catch (e) {
      setBinaryStatus({ exists: false, error: e.message });
    }
  };

  useEffect(() => {
    checkCurrentBinary();
    handleFetchReleases();

    if (typeof window.tiny !== 'undefined' && window.tiny.api) {
      const unsub = window.tiny.api.on('binary-install-status', (info) => {
        if (info) setInstallProgress(info);
      });
      return () => { if (unsub) unsub(); };
    }
  }, [config.binaryPath]);

  const handleBrowseBinary = async () => {
    if (typeof window.tiny === 'undefined') return;
    try {
      const selected = await window.tiny.dialog.openFile({
        title: 'Select llama-server.exe Binary',
        filters: [{ name: 'Executables', extensions: ['exe'] }],
      });
      if (selected && selected.length > 0) {
        await saveConfig({ binaryPath: selected[0] });
        checkCurrentBinary();
      }
    } catch (e) {
      console.log('Binary picker cancelled:', e);
    }
  };

  const handleBrowseModelsDir = async () => {
    if (typeof window.tiny === 'undefined') return;
    try {
      const picker = window.tiny.dialog.openDirectory || window.tiny.dialog.openFile;
      const selected = await picker({
        title: 'Select Models Storage Directory',
        directory: true,
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: form.modelsDir,
      });
      if (selected && selected.length > 0) {
        const folder = selected[0];
        setForm(prev => ({ ...prev, modelsDir: folder }));
        await saveConfig({ modelsDir: folder });
      }
    } catch (e) {
      console.log('Folder picker cancelled:', e);
    }
  };

  const handleFetchReleases = async () => {
    if (typeof window.tiny === 'undefined') return;
    setIsLoadingReleases(true);
    try {
      const data = await window.tiny.api.call('getPrismReleases');
      setReleases(data);
    } catch (e) {
      console.error('getPrismReleases failed:', e);
    } finally {
      setIsLoadingReleases(false);
    }
  };

  const handleInstallRelease = async (asset) => {
    if (typeof window.tiny === 'undefined' || !asset) return;
    setInstallingAsset(asset.name);
    setInstallProgress({ status: 'starting', message: `Initializing download for ${asset.name}...`, progress: 5 });
    try {
      const res = await window.tiny.api.call('installBinaryPackage', {
        url: asset.downloadUrl,
        filename: asset.name,
        companionUrl: asset.companionUrl || null,
      });
      await saveConfig({ binaryPath: res.installedPath });
      await checkCurrentBinary();
      if (window.tiny.dialog) {
        window.tiny.dialog.alert('Binary Installed Successfully', `Installed ${asset.name}!\nRuntime: ${res.installedPath}\nVersion: ${res.version || 'Verified'}`);
      }
    } catch (e) {
      if (window.tiny.dialog) {
        window.tiny.dialog.alert('Install Failed', e.message);
      }
    } finally {
      setInstallingAsset(null);
      setTimeout(() => setInstallProgress(null), 3000);
    }
  };

  // Determine recommended asset for user's GPU
  const recommendedAsset = React.useMemo(() => {
    if (!releases || !releases.assets || releases.assets.length === 0) return null;
    if (isNvidia) {
      if (/30\d\d|20\d\d|16\d\d/i.test(gpuName)) {
        return releases.assets.find(a => a.name.includes('cuda-12.4')) || releases.assets.find(a => a.name.includes('cuda'));
      }
      return releases.assets.find(a => a.name.includes('cuda-13.3')) || releases.assets.find(a => a.name.includes('cuda'));
    }
    if (isAmd) {
      return releases.assets.find(a => a.name.includes('hip') || a.name.includes('vulkan'));
    }
    return releases.assets.find(a => a.name.includes('vulkan')) || releases.assets.find(a => a.name.includes('cpu-x64'));
  }, [releases, isNvidia, isAmd, gpuName]);

  const handleSaveForm = async (e) => {
    e.preventDefault();
    await saveConfig(form);
    setSaveMessage('Configuration saved successfully.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-base-100">
      
      {/* SECTION 1: Binary Management */}
      <section className="space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-base-300">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-base text-white tracking-wide">llama.cpp Runtime Engine</h2>
              <p className="text-xs text-base-content/70">
                Download, install, and configure optimized PrismML foundation binaries with GPU acceleration.
              </p>
            </div>
          </div>

          {/* Hardware Detection Badge */}
          {gpuName && (
            <div className="flex items-center gap-2 bg-base-200 border border-base-300 px-3 py-1.5 rounded-lg shrink-0">
              <Zap className="w-4 h-4 text-primary" />
              <div className="text-2xs font-mono">
                <span className="text-base-content/60">Hardware: </span>
                <span className="text-white font-bold">{gpuName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Current Binary Status Card */}
        <div className="card bg-base-200 border border-base-300 shadow-md">
          <div className="card-body p-5 space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-base-content/60">
                    Active Binary Runtime
                  </span>
                  {binaryStatus?.exists ? (
                    <span className="badge badge-success badge-xs gap-1 font-mono text-2xs font-bold">
                      <Check className="w-2.5 h-2.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="badge badge-warning badge-xs font-mono text-2xs">
                      Not Found / Needs Setup
                    </span>
                  )}
                  {binaryStatus?.isPrism && (
                    <span className="badge badge-primary badge-outline badge-xs font-mono text-2xs">
                      PrismML Optimized
                    </span>
                  )}
                  {binaryStatus?.isCuda && (
                    <span className="badge badge-accent badge-outline badge-xs font-mono text-2xs">
                      CUDA GPU
                    </span>
                  )}
                </div>

                <div className="font-mono text-xs text-white truncate bg-base-300/50 p-2.5 rounded border border-base-300 flex items-center justify-between">
                  <span className="truncate">{config.binaryPath || 'bin/prism-llama/llama-server.exe (Built-in default)'}</span>
                </div>

                {binaryStatus?.version && (
                  <div className="text-2xs font-mono text-base-content/70 truncate pt-0.5">
                    Engine Version: <span className="text-primary font-medium">{binaryStatus.version}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleBrowseBinary}
                  className="btn btn-outline btn-neutral btn-sm gap-1.5"
                  title="Browse local disk for custom llama-server.exe"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Browse .exe</span>
                </button>
              </div>
            </div>

            {/* Quick One-Click Setup Recommendation Banner */}
            {recommendedAsset && (
              <div className="bg-primary/10 border border-primary/30 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-bold text-xs text-white">
                      Recommended Runtime for {gpuName || 'Your System'}:
                    </span>
                    <span className="badge badge-primary badge-xs font-mono text-2xs">
                      {recommendedAsset.backend}
                    </span>
                  </div>
                  <p className="text-2xs text-base-content/70">
                    {recommendedAsset.description} ({recommendedAsset.sizeFormatted})
                    {recommendedAsset.companionUrl && ' • Includes CUDA runtime companion DLLs'}
                  </p>
                </div>

                <button
                  onClick={() => handleInstallRelease(recommendedAsset)}
                  disabled={!!installingAsset}
                  className="btn btn-primary btn-sm font-bold gap-1.5 shrink-0 shadow-md cursor-pointer"
                >
                  {installingAsset === recommendedAsset.name ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>One-Click Auto Setup</span>
                </button>
              </div>
            )}

            {/* Installation Progress Bar */}
            {installProgress && (
              <div className="bg-base-300/60 border border-primary/40 p-3.5 rounded-lg space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-2xs font-mono">
                  <div className="flex items-center gap-2 text-white">
                    <span className="loading loading-spinner loading-xs text-primary" />
                    <span>{installProgress.message}</span>
                  </div>
                  <span className="text-primary font-bold">{installProgress.progress || 0}%</span>
                </div>
                <progress 
                  className="progress progress-primary w-full bg-base-300" 
                  value={installProgress.progress || 0} 
                  max="100" 
                />
              </div>
            )}

            {/* Releases Header & Fetcher */}
            <div className="pt-2 border-t border-base-300/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-white">
                  Official PrismML llama.cpp Builds
                </span>
                {releases && (
                  <span className="badge badge-ghost badge-xs font-mono text-2xs text-base-content/60">
                    {releases.tag}
                  </span>
                )}
              </div>
              <button
                onClick={handleFetchReleases}
                disabled={isLoadingReleases}
                className="btn btn-neutral btn-xs gap-1 font-mono"
              >
                <RotateCw className={`w-3 h-3 ${isLoadingReleases ? 'animate-spin text-primary' : ''}`} />
                <span>Refresh Builds</span>
              </button>
            </div>

            {/* Releases Grid */}
            {releases && releases.assets && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {releases.assets.map((asset) => {
                  const isRec = recommendedAsset && recommendedAsset.name === asset.name;
                  const isCurrentlyInstalled = config.binaryPath && config.binaryPath.includes(asset.name.replace('.zip', ''));

                  return (
                    <div
                      key={asset.name}
                      className={`card bg-base-300/40 border p-4 transition-all space-y-3 ${
                        isRec ? 'border-primary ring-1 ring-primary/40 bg-base-300/70 shadow-md' : 'border-base-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white truncate">
                              {asset.backend}
                            </span>
                            {isRec && (
                              <span className="badge badge-primary badge-xs font-mono text-2xs font-semibold">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-2xs text-base-content/60 leading-tight">
                            {asset.description}
                          </div>
                        </div>

                        <span className="badge badge-neutral badge-xs font-mono text-2xs shrink-0">
                          {asset.sizeFormatted}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-base-300/40 text-2xs font-mono">
                        <div className="text-base-content/50 truncate max-w-[200px]" title={asset.name}>
                          {asset.name}
                        </div>

                        <button
                          onClick={() => handleInstallRelease(asset)}
                          disabled={installingAsset === asset.name}
                          className={`btn btn-xs font-bold gap-1 cursor-pointer ${
                            isRec ? 'btn-primary text-black' : 'btn-neutral text-white hover:border-primary/50'
                          }`}
                        >
                          {installingAsset === asset.name ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          <span>Install &amp; Set Active</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

      </section>

      {/* SECTION 2: Server & Engine Configuration Form */}
      <section className="space-y-4">
        
        <div className="flex items-center gap-2.5 pb-2 border-b border-base-300">
          <Sliders className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-base text-white tracking-wide">Server Parameters</h2>
            <p className="text-xs text-base-content/70">
              Default network binding, batching, and directory settings.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveForm} className="card bg-base-200 border border-base-300 shadow-md">
          <div className="card-body p-6 space-y-6">
            
            {saveMessage && (
              <div className="alert alert-info py-2 px-3 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>{saveMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Host */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-base-content/80">
                  Bind Host (--host)
                </label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="input input-bordered input-sm w-full font-mono text-xs bg-base-100"
                />
              </div>

              {/* Port */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-base-content/80">
                  Port (--port)
                </label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value, 10) || 8080 })}
                  className="input input-bordered input-sm w-full font-mono text-xs bg-base-100"
                />
              </div>

              {/* Batching Pipeline (-b and -ub) */}
              <div className="space-y-1.5 md:col-span-2 bg-base-300/40 p-3.5 rounded-lg border border-base-300 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-base-300/60">
                  <div className="text-xs font-semibold text-white">Prompt Evaluation &amp; Batching Pipeline</div>
                  <span className="badge badge-primary badge-outline badge-2xs font-mono">Engine Rule: -ub ≤ -b</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                      <span>Prompt Batch Size (-b)</span>
                      <span className="text-2xs text-base-content/50">Logical Ingest</span>
                    </label>
                    <input
                      type="number"
                      step="64"
                      min="64"
                      value={form.batchSize}
                      onChange={(e) => {
                        const newB = parseInt(e.target.value, 10) || 512;
                        const currentUb = form.uBatchSize || 512;
                        const clampedUb = Math.min(currentUb, newB);
                        setForm({ ...form, batchSize: newB, uBatchSize: clampedUb });
                      }}
                      className="input input-bordered input-sm w-full font-mono text-xs bg-base-100"
                    />
                    <p className="text-2xs text-base-content/50">Total token block size evaluated per prompt ingest step.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                      <span>Micro-Batch Size (-ub)</span>
                      <span className="text-2xs text-base-content/50">Physical Compute</span>
                    </label>
                    <input
                      type="number"
                      step="64"
                      min="64"
                      value={form.uBatchSize}
                      onChange={(e) => {
                        const newUb = parseInt(e.target.value, 10) || 512;
                        const currentB = form.batchSize || 512;
                        const expandedB = Math.max(currentB, newUb);
                        setForm({ ...form, uBatchSize: newUb, batchSize: expandedB });
                      }}
                      className="input input-bordered input-sm w-full font-mono text-xs bg-base-100"
                    />
                    <p className="text-2xs text-base-content/50">GPU kernel pass chunk size to prevent VRAM allocation spikes.</p>
                  </div>
                </div>
              </div>

              {/* Models Directory */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-base-content/80">
                  Models Storage Folder
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.modelsDir}
                    onChange={(e) => setForm({ ...form, modelsDir: e.target.value })}
                    className="input input-bordered input-sm flex-1 font-mono text-xs bg-base-100"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseModelsDir}
                    className="btn btn-outline btn-neutral btn-sm"
                  >
                    Browse
                  </button>
                </div>
              </div>

            </div>

            {/* Extra CLI Args */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-base-content/80">
                Additional llama-server CLI Arguments
              </label>
              <input
                type="text"
                placeholder="e.g. --split-mode row --cont-batching"
                value={form.extraArgs}
                onChange={(e) => setForm({ ...form, extraArgs: e.target.value })}
                className="input input-bordered input-sm w-full font-mono text-xs bg-base-100"
              />
              <span className="text-2xs text-base-content/50 font-mono">
                Appended directly to the process execution invocation.
              </span>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-base-300 flex justify-end">
              <button type="submit" className="btn btn-primary btn-sm gap-2 font-bold shadow-md">
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </button>
            </div>

          </div>
        </form>

      </section>

    </div>
  );
}
