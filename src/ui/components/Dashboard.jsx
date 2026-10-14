import React, { useState } from 'react';
import { useApp, UNIFIED_PRESETS } from '../context/AppContext';
import { 
  Activity, 
  Cpu, 
  Box, 
  Sliders, 
  Zap, 
  Play, 
  Square, 
  RotateCw, 
  ExternalLink, 
  Copy, 
  HeartPulse, 
  Eye, 
  Layers, 
  CheckCircle2, 
  Sparkles,
  Database
} from 'lucide-react';

export default function Dashboard() {
  const { 
    config, 
    saveConfig, 
    systemInfo, 
    serverStatus, 
    startServer, 
    stopServer, 
    restartServer, 
    localModels, 
    setActiveTab,
    activePreset,
    applyGlobalPreset,
  } = useApp();

  const [healthResult, setHealthResult] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isRunning = serverStatus.running;
  const isStarting = serverStatus.starting;

  // Active Model Lookup
  const activeModel = localModels.find(m => m.path === config.selectedModel || m.name === config.selectedModel);
  const activeMmproj = localModels.find(m => m.path === config.selectedMmproj || m.name === config.selectedMmproj);
  const modelName = activeModel ? activeModel.name : (config.selectedModel ? config.selectedModel.split(/[\\/]/).pop() : 'No Model Selected');

  // Loaded model's native context limit (defaulting to 256K for Prism foundation models)
  const modelNativeMax = (activeModel && activeModel.maxContext) ? activeModel.maxContext : 262144;
  const isRopeActive = config.ropeScaling && config.ropeScaling !== 'none';
  const baseMax = isRopeActive ? Math.max(modelNativeMax * 2, 262144) : modelNativeMax;
  const maxSliderLimit = Math.max(baseMax, config.ctxSize || 8192);

  const formatK = (tokens) => {
    if (!tokens) return '0';
    if (tokens >= 1048576) return `${(tokens / 1048576).toFixed(1).replace('.0', '')}M`;
    if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`;
    return String(tokens);
  };

  const handleCopyEndpoint = () => {
    const host = serverStatus.host || config.host || '127.0.0.1';
    const port = serverStatus.port || config.port || 8080;
    const url = `http://${host}:${port}/v1`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleOpenBrowser = () => {
    const host = serverStatus.host || config.host || '127.0.0.1';
    const port = serverStatus.port || config.port || 8080;
    window.open(`http://${host}:${port}`, '_blank');
  };

  const handleTestHealth = async () => {
    const host = serverStatus.host || config.host || '127.0.0.1';
    const port = serverStatus.port || config.port || 8080;
    try {
      const res = await fetch(`http://${host}:${port}/health`);
      if (res.ok) {
        setHealthResult('Server healthy (HTTP 200)');
      } else {
        setHealthResult(`Health check returned ${res.status}`);
      }
    } catch (e) {
      setHealthResult(`Unreachable (${e.message})`);
    }
    setTimeout(() => setHealthResult(null), 3500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      
      {/* Top Hero: Inference Supervisor Card */}
      <div className="card bg-base-200 border border-base-300 shadow-lg">
        <div className="card-body p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="card-title text-base text-white tracking-wide">Inference Supervisor</h2>
                <div className="badge badge-neutral gap-1.5 py-2.5 px-3 font-mono text-xs border border-base-300 ml-2">
                  <span className={`status-dot ${isRunning ? 'running' : isStarting ? 'starting' : 'stopped'}`} />
                  <span>{isRunning ? 'Online & Listening' : isStarting ? 'Initializing...' : 'Server Offline'}</span>
                </div>
              </div>
              <p className="text-xs text-base-content/70">
                Local high-performance llama.cpp OpenAI-compatible HTTP inference service.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {isRunning ? (
                <button onClick={stopServer} className="btn btn-error btn-sm gap-2 font-bold shadow-md">
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Server</span>
                </button>
              ) : (
                <button onClick={startServer} disabled={isStarting} className="btn btn-primary btn-sm gap-2 font-bold shadow-md">
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Server</span>
                </button>
              )}

              <button onClick={restartServer} className="btn btn-neutral btn-sm btn-square" title="Restart Server">
                <RotateCw className="w-4 h-4" />
              </button>

              <button onClick={handleOpenBrowser} disabled={!isRunning} className="btn btn-outline btn-neutral btn-sm gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Web UI</span>
              </button>

              <button onClick={handleCopyEndpoint} className="btn btn-outline btn-neutral btn-sm gap-1.5 text-xs">
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUrl ? 'Copied URL!' : 'API Endpoint'}</span>
              </button>

              <button onClick={handleTestHealth} disabled={!isRunning} className="btn btn-outline btn-neutral btn-sm gap-1.5 text-xs">
                <HeartPulse className="w-3.5 h-3.5 text-primary" />
                <span>Health</span>
              </button>
            </div>

          </div>

          {healthResult && (
            <div className="alert alert-info py-2 px-3 text-xs mt-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{healthResult}</span>
            </div>
          )}

          {/* Stats Grid inside Supervisor */}
          <div className="stats stats-horizontal bg-base-300/40 border border-base-300 mt-4 rounded-lg w-full text-xs">
            <div className="stat py-3 px-4">
              <div className="stat-title text-2xs uppercase tracking-wider text-base-content/60">Host &amp; Port</div>
              <div className="stat-value text-sm font-mono text-white mt-0.5">
                {serverStatus.host || config.host}:{serverStatus.port || config.port}
              </div>
            </div>
            <div className="stat py-3 px-4">
              <div className="stat-title text-2xs uppercase tracking-wider text-base-content/60">Process PID</div>
              <div className="stat-value text-sm font-mono text-primary mt-0.5">
                {serverStatus.pid || '—'}
              </div>
            </div>
            <div className="stat py-3 px-4">
              <div className="stat-title text-2xs uppercase tracking-wider text-base-content/60">Server Uptime</div>
              <div className="stat-value text-sm font-mono text-white mt-0.5">
                {isRunning ? `${serverStatus.uptime || 0}s` : '0s'}
              </div>
            </div>
            <div className="stat py-3 px-4">
              <div className="stat-title text-2xs uppercase tracking-wider text-base-content/60">Context Allocation</div>
              <div className="stat-value text-sm font-mono text-white mt-0.5">
                {config.ctxSize.toLocaleString()} tokens
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Middle Row: Active Model & Hardware Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Model Card */}
        <div className="card bg-base-200 border border-base-300 shadow-md">
          <div className="card-body p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-white">Active Model</h3>
              </div>
              <button 
                onClick={() => setActiveTab('models')}
                className="btn btn-outline btn-primary btn-xs"
              >
                Switch Model
              </button>
            </div>

            <div className="bg-base-300/50 p-3.5 rounded-lg border border-base-300 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-white truncate" title={modelName}>
                  {modelName}
                </span>
                <span className="badge badge-primary badge-outline badge-xs font-mono shrink-0">
                  {activeModel?.quant || 'GGUF'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-2xs font-mono text-base-content/70">
                <span>Size: <strong className="text-white">{activeModel ? activeModel.sizeFormatted : '—'}</strong></span>
                <span>Layers Offloaded: <strong className="text-primary">{config.nGl} layers</strong></span>
              </div>

              {activeMmproj && (
                <div className="flex items-center gap-1.5 pt-1 text-2xs text-secondary font-mono border-t border-base-300/40">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Vision Projector: {activeMmproj.name}</span>
                </div>
              )}
            </div>

            <div className="text-2xs text-base-content/60 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Optimized for BitNet b1.58 Ternary and high-efficiency GGUF quantizations.</span>
            </div>
          </div>
        </div>

        {/* Hardware & Acceleration Card */}
        <div className="card bg-base-200 border border-base-300 shadow-md">
          <div className="card-body p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-white">Hardware Acceleration</h3>
            </div>

            <div className="space-y-2.5">
              <div className="bg-base-300/50 p-3 rounded-lg border border-base-300 flex items-center justify-between">
                <div>
                  <div className="text-2xs text-base-content/60 uppercase tracking-wider font-semibold">Processor</div>
                  <div className="text-xs font-mono text-white mt-0.5 truncate max-w-xs">
                    {systemInfo.cpuModel || 'CPU Detected'}
                  </div>
                </div>
                <div className="badge badge-neutral font-mono text-xs border border-base-300">
                  {systemInfo.cpuCores || 8} Threads
                </div>
              </div>

              <div className="bg-base-300/50 p-3 rounded-lg border border-base-300 flex items-center justify-between">
                <div>
                  <div className="text-2xs text-base-content/60 uppercase tracking-wider font-semibold">GPU Acceleration</div>
                  <div className="text-xs font-mono text-white mt-0.5 truncate max-w-xs">
                    {systemInfo.gpus && systemInfo.gpus.length > 0 ? systemInfo.gpus[0].name : 'Direct GPU / CPU Offload'}
                  </div>
                </div>
                <div className="badge badge-primary badge-outline font-mono text-xs">
                  {config.nGl > 0 ? `${config.nGl} Layers` : 'CPU Only'}
                </div>
              </div>
            </div>

            <div className="text-2xs text-base-content/60 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>llama.cpp automatically allocates tensor computations across available VRAM.</span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section: Execution Presets & Fine-Tuning */}
      <div className="card bg-base-200 border border-base-300 shadow-md">
        <div className="card-body p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-white">Execution Parameters &amp; Presets</h3>
                <span className="badge badge-primary badge-outline badge-xs font-mono ml-1">
                  Coupled with KV Cache
                </span>
              </div>
              <p className="text-2xs text-base-content/60">
                Unified engine presets simultaneously configure GPU offload, KV cache quantization, and prompt batching.
              </p>
            </div>
            
            {/* Unified Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-base-300/60 p-1 rounded-lg border border-base-300">
              {UNIFIED_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => applyGlobalPreset(p.id)}
                  className={`btn btn-xs font-semibold px-2.5 transition-all cursor-pointer ${
                    activePreset === p.id 
                      ? 'btn-primary text-black font-bold shadow-sm' 
                      : 'btn-ghost text-base-content/80 hover:text-white'
                  }`}
                  title={p.desc}
                >
                  {p.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* Coupled KV Cache & Ingestion Status Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-base-300/40 px-3.5 py-2.5 rounded-lg border border-base-300 text-2xs font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base-content/60">Active Profile:</span>
              <span className="badge badge-primary badge-sm font-mono text-2xs font-bold">
                {UNIFIED_PRESETS.find(p => p.id === activePreset)?.name || 'Custom Tuned'}
              </span>
              <span className="opacity-40">|</span>
              <span className="text-base-content/70">
                KV Cache: <strong className="text-primary">{config.cacheTypeK?.toUpperCase() || 'Q8_0'}</strong>
              </span>
              <span className="opacity-40">|</span>
              <span className="text-base-content/70">
                Prompt Batch: <strong className="text-white">{config.batchSize || 512}</strong> (uBatch: <strong className="text-white">{config.uBatchSize || 512}</strong>)
              </span>
            </div>

            <button
              onClick={() => setActiveTab('context')}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer font-sans"
            >
              <span>Fine-Tune KV Cache &amp; Batching</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Sliders Grid: 4 Essential Levers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            
            {/* Context Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-base-content/80">Context Window (-c)</span>
                  <span className="badge badge-primary badge-outline badge-2xs font-mono">
                    Max: {formatK(modelNativeMax)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-primary font-bold">{config.ctxSize?.toLocaleString()} tokens</span>
                  <span className="text-2xs font-mono text-base-content/50">({formatK(config.ctxSize)})</span>
                </div>
              </div>
              <input 
                type="range" 
                min="512" 
                max={maxSliderLimit} 
                step={maxSliderLimit > 65536 ? "1024" : "512"} 
                value={config.ctxSize || 8192} 
                onChange={(e) => saveConfig({ ctxSize: parseInt(e.target.value, 10) })}
                className="range range-primary range-sm" 
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                <span>512</span>
                <span>{formatK(Math.round(maxSliderLimit * 0.25))}</span>
                <span>{formatK(Math.round(maxSliderLimit * 0.5))}</span>
                <span>{formatK(maxSliderLimit)}</span>
              </div>
            </div>

            {/* GPU Layers Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-base-content/80">GPU Layers (-ngl)</span>
                <span className="font-mono text-primary font-bold">{config.nGl} layers</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="99" 
                step="1" 
                value={config.nGl} 
                onChange={(e) => saveConfig({ nGl: parseInt(e.target.value, 10) })}
                className="range range-primary range-sm" 
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                <span>0 (CPU)</span>
                <span>32</span>
                <span>64</span>
                <span>99 (All)</span>
              </div>
            </div>

            {/* CPU Threads Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-base-content/80">CPU Threads (-t)</span>
                <span className="font-mono text-primary font-bold">{config.threads} threads</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max={Math.max(16, systemInfo.cpuCores || 8)} 
                step="1" 
                value={config.threads} 
                onChange={(e) => saveConfig({ threads: parseInt(e.target.value, 10) })}
                className="range range-primary range-sm" 
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                <span>1</span>
                <span>{Math.floor((systemInfo.cpuCores || 8) / 2)}</span>
                <span>{systemInfo.cpuCores || 8} cores</span>
              </div>
            </div>

            {/* Prompt Batch Size Slider (-b) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-base-content/80">Prompt Batch (-b)</span>
                <span className="font-mono text-primary font-bold">{config.batchSize || 512} tokens</span>
              </div>
              <input 
                type="range" 
                min="128" 
                max="2048" 
                step="128" 
                value={config.batchSize || 512} 
                onChange={(e) => {
                  const newB = parseInt(e.target.value, 10);
                  const newUb = Math.min(config.uBatchSize || 512, newB);
                  saveConfig({ batchSize: newB, uBatchSize: newUb });
                }}
                className="range range-primary range-sm" 
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                <span>128</span>
                <span>512</span>
                <span>1024</span>
                <span>2048</span>
              </div>
            </div>

          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-base-300">
            <label className="label cursor-pointer gap-3 p-0">
              <input 
                type="checkbox" 
                checked={config.flashAttn ?? true} 
                onChange={(e) => saveConfig({ flashAttn: e.target.checked })}
                className="checkbox checkbox-primary checkbox-sm" 
              />
              <span className="label-text text-xs text-base-content/80 font-medium">Flash Attention (-fa)</span>
            </label>

            <label className="label cursor-pointer gap-3 p-0">
              <input 
                type="checkbox" 
                checked={config.jinja ?? true} 
                onChange={(e) => saveConfig({ jinja: e.target.checked })}
                className="checkbox checkbox-primary checkbox-sm" 
              />
              <span className="label-text text-xs text-base-content/80 font-medium">Jinja Chat Templates</span>
            </label>
          </div>

        </div>
      </div>

    </div>
  );
}
