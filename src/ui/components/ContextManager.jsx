import React, { useMemo } from 'react';
import { useApp, UNIFIED_PRESETS } from '../context/AppContext';
import { 
  Database, 
  Sparkles, 
  Zap, 
  Layers, 
  Sliders, 
  Activity, 
  ShieldCheck, 
  TrendingDown, 
  HardDrive, 
  Info, 
  Cpu, 
  Check, 
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  Workflow
} from 'lucide-react';

export default function ContextManager() {
  const { 
    config, 
    saveConfig, 
    localModels, 
    activePreset, 
    setActivePreset, 
    applyGlobalPreset, 
    setActiveTab 
  } = useApp();

  const activeModel = localModels.find(m => m.path === config.selectedModel || m.name === config.selectedModel);
  const layersCount = config.nGl > 0 ? config.nGl : 32;

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

  // KV Cache Memory Calculation
  // F16 = 2 bytes per element. Q8_0 = 1 byte. Q4_0 = 0.5 bytes.
  const bytesPerTokenK = 
    config.cacheTypeK === 'q4_0' ? 0.5 :
    config.cacheTypeK === 'q8_0' ? 1.0 :
    config.cacheTypeK === 'q5_0' ? 0.65 : 2.0;

  const bytesPerTokenV = 
    config.cacheTypeV === 'q4_0' ? 0.5 :
    config.cacheTypeV === 'q8_0' ? 1.0 :
    config.cacheTypeV === 'q5_0' ? 0.65 : 2.0;

  // Approximate KV Cache VRAM calculation formula for standard 8B/27B models (head_dim * n_heads * 2)
  const estimatedKvBytes = useMemo(() => {
    const tokens = config.ctxSize || 8192;
    // Typical embedding dimension factor for KV tensor
    const dimFactor = 1024 * (layersCount / 32);
    const kBytes = tokens * dimFactor * bytesPerTokenK;
    const vBytes = tokens * dimFactor * bytesPerTokenV;
    return kBytes + vBytes;
  }, [config.ctxSize, bytesPerTokenK, bytesPerTokenV, layersCount]);

  const f16BaselineBytes = useMemo(() => {
    const tokens = config.ctxSize || 8192;
    const dimFactor = 1024 * (layersCount / 32);
    return tokens * dimFactor * 4.0;
  }, [config.ctxSize, layersCount]);

  const savingsPercent = Math.max(0, Math.round((1 - (estimatedKvBytes / f16BaselineBytes)) * 100));
  const estimatedKvMb = (estimatedKvBytes / (1024 * 1024)).toFixed(0);
  const f16BaselineMb = (f16BaselineBytes / (1024 * 1024)).toFixed(0);

  const setCtxQuick = (tokens) => {
    setActivePreset('custom');
    saveConfig({ ctxSize: tokens });
  };

  const quickJumps = useMemo(() => {
    const standard = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144];
    const available = standard.filter(t => t <= maxSliderLimit);
    if (!available.includes(modelNativeMax) && modelNativeMax <= maxSliderLimit && modelNativeMax >= 1024) {
      available.push(modelNativeMax);
      available.sort((a, b) => a - b);
    }
    return available;
  }, [maxSliderLimit, modelNativeMax]);

  const tickMarks = useMemo(() => {
    const raw = [
      1024,
      Math.round((maxSliderLimit * 0.25) / 1024) * 1024,
      Math.round((maxSliderLimit * 0.5) / 1024) * 1024,
      Math.round((maxSliderLimit * 0.75) / 1024) * 1024,
      maxSliderLimit,
    ];
    return [...new Set(raw)].sort((a, b) => a - b);
  }, [maxSliderLimit]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-base-100">
      
      {/* Top Banner: Context & KV Cache Strategy */}
      <div className="card bg-base-200 border border-base-300 shadow-lg">
        <div className="card-body p-6 space-y-4">
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="card-title text-base text-white tracking-wide">
                  Context Window &amp; KV Cache Optimizer
                </h2>
                <span className="badge badge-primary badge-outline badge-xs font-mono ml-1">
                  Atomic / LM Studio Standards
                </span>
              </div>
              <p className="text-xs text-base-content/70">
                Configure Key &amp; Value tensor quantization, Flash Attention, and context rollover to unlock massive context windows without VRAM bottlenecks.
              </p>
            </div>

            {/* Live Savings Badge */}
            <div className="flex items-center gap-2 bg-base-300/50 p-2.5 rounded-lg border border-base-300 shrink-0">
              <TrendingDown className="w-4 h-4 text-primary" />
              <div className="text-2xs font-mono">
                <div className="text-base-content/60">KV VRAM Savings</div>
                <div className="text-sm font-bold text-primary">{savingsPercent}% Footprint Reduction</div>
              </div>
            </div>
          </div>

          {/* Unified Preset Buttons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
            {UNIFIED_PRESETS.map((p) => {
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyGlobalPreset(p.id)}
                  className={`card bg-base-300/40 border text-left p-4 transition-all hover:border-primary/50 cursor-pointer ${
                    isSelected ? 'border-primary ring-1 ring-primary/40 shadow-md bg-base-300/80' : 'border-base-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">{p.name}</span>
                    <span className={`badge ${p.badgeColor} badge-xs font-mono text-2xs`}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-2xs text-base-content/60 leading-relaxed">
                    {p.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Coupled Execution & Context Status Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-base-300/50 px-3.5 py-2.5 rounded-lg border border-base-300 text-2xs font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base-content/60">Execution Coupling:</span>
              <span className="badge badge-primary badge-sm font-mono text-2xs font-bold">
                {UNIFIED_PRESETS.find(p => p.id === activePreset)?.name || 'Custom Tuned'}
              </span>
              <span className="opacity-40">|</span>
              <span className="text-base-content/70">
                GPU Offload: <strong className="text-primary">{config.nGl ?? 0} layers</strong>
              </span>
              <span className="opacity-40">|</span>
              <span className="text-base-content/70">
                Threads: <strong className="text-white">{config.threads || 8}</strong>
              </span>
              <span className="opacity-40">|</span>
              <span className="text-base-content/70">
                Batching: <strong className="text-primary">-b {config.batchSize || 512}</strong> (uBatch: <strong className="text-primary">-ub {config.uBatchSize || 512}</strong>)
              </span>
            </div>

            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer font-sans"
            >
              <span>View Dashboard Execution Sliders</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

        </div>
      </div>

      {/* Middle Row: KV Cache Calculator & Quick Context Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KV Cache Memory Calculator Box */}
        <div className="card bg-base-200 border border-base-300 shadow-md lg:col-span-1">
          <div className="card-body p-5 space-y-4">
            
            <div className="flex items-center gap-2 pb-2 border-b border-base-300">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-white">Live VRAM Estimator</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-base-content/70">Estimated KV Memory:</span>
                <span className="font-mono text-primary font-bold text-sm">~{estimatedKvMb} MB</span>
              </div>

              <div className="flex justify-between items-center text-2xs font-mono text-base-content/50">
                <span>Standard F16 baseline:</span>
                <span className="line-through">~{f16BaselineMb} MB</span>
              </div>

              {/* Memory Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-2xs font-mono">
                  <span className="text-base-content/60">VRAM Footprint</span>
                  <span className="text-primary font-bold">{savingsPercent}% Saved</span>
                </div>
                <progress 
                  className="progress progress-primary w-full bg-base-300" 
                  value={100 - savingsPercent} 
                  max="100" 
                />
              </div>

              <div className="bg-base-300/50 p-3 rounded-lg border border-base-300 space-y-1.5 text-2xs font-mono text-base-content/70">
                <div className="flex justify-between">
                  <span>K-Cache Type:</span>
                  <strong className="text-white">{config.cacheTypeK?.toUpperCase() || 'Q8_0'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>V-Cache Type:</span>
                  <strong className="text-white">{config.cacheTypeV?.toUpperCase() || 'Q8_0'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Context Allocation:</span>
                  <strong className="text-white">{config.ctxSize?.toLocaleString()} tokens</strong>
                </div>
              </div>
            </div>

            <div className="text-2xs text-base-content/50 flex items-center gap-1.5 pt-1">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Flash Attention prevents VRAM spikes during long prompt ingest.</span>
            </div>

          </div>
        </div>

        {/* Context Window Size Controls */}
        <div className="card bg-base-200 border border-base-300 shadow-md lg:col-span-2">
          <div className="card-body p-5 space-y-5">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-base-300">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-white">Context Size (-c)</h3>
                <span className="badge badge-primary badge-outline badge-xs font-mono">
                  Model Native: {formatK(modelNativeMax)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary font-bold text-sm">
                  {config.ctxSize?.toLocaleString()} tokens
                </span>
                <span className="text-2xs font-mono text-base-content/50">
                  ({formatK(config.ctxSize)})
                </span>
              </div>
            </div>

            {/* Context Slider */}
            <div className="space-y-2">
              <input 
                type="range" 
                min="1024" 
                max={maxSliderLimit} 
                step={maxSliderLimit > 65536 ? "2048" : "1024"} 
                value={config.ctxSize || 8192} 
                onChange={(e) => {
                  setActivePreset('custom');
                  saveConfig({ ctxSize: parseInt(e.target.value, 10) });
                }}
                className="range range-primary range-sm" 
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                {tickMarks.map(t => (
                  <span key={t}>{formatK(t)}</span>
                ))}
              </div>
            </div>

            {/* Quick Context Jump Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xs uppercase tracking-wider font-semibold text-base-content/60">
                  Quick Jump Presets
                </div>
                {modelNativeMax >= 1024 && (
                  <button
                    onClick={() => {
                      setActivePreset('custom');
                      setCtxQuick(modelNativeMax);
                    }}
                    className={`btn btn-2xs font-mono gap-1 cursor-pointer transition-all ${
                      config.ctxSize === modelNativeMax 
                        ? 'btn-primary text-black font-bold shadow-sm' 
                        : 'btn-outline btn-primary text-primary hover:bg-primary hover:text-black'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Load Native Max: {formatK(modelNativeMax)}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {quickJumps.map((tokens) => (
                  <button
                    key={tokens}
                    onClick={() => {
                      setActivePreset('custom');
                      setCtxQuick(tokens);
                    }}
                    className={`btn btn-xs font-mono font-semibold px-2.5 cursor-pointer transition-all ${
                      config.ctxSize === tokens 
                        ? 'btn-primary text-black font-bold shadow-sm' 
                        : 'btn-neutral text-base-content/80 hover:border-primary/50'
                    }`}
                  >
                    {formatK(tokens)}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-2xs text-base-content/60 font-mono">
              Dynamic ceiling scaled to loaded model's architecture ({formatK(modelNativeMax)} native). Using Q8_0 or Q4_0 allows you to run up to 256K context without OOM.
            </div>

          </div>
        </div>

      </div>

      {/* Advanced KV Cache Parameters Grid */}
      <div className="card bg-base-200 border border-base-300 shadow-md">
        <div className="card-body p-6 space-y-6">
          
          <div className="flex items-center gap-2 pb-2 border-b border-base-300">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-white">Fine-Tuning &amp; Advanced Options</h3>
          </div>

          <div className="space-y-6">
            
            {/* Subsection 1: KV Cache Quantization */}
            <div>
              <div className="text-2xs uppercase tracking-wider font-semibold text-base-content/60 mb-3 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-primary" />
                <span>KV Cache Precision &amp; Reuse</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Key Cache Quantization (-ctk) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                    <span>K-Cache Type (-ctk)</span>
                    <span className="font-mono text-primary text-2xs">{config.cacheTypeK || 'q8_0'}</span>
                  </label>
                  <select
                    value={config.cacheTypeK || 'q8_0'}
                    onChange={(e) => {
                      setActivePreset('custom');
                      saveConfig({ cacheTypeK: e.target.value });
                    }}
                    className="select select-bordered select-sm w-full font-mono text-xs bg-base-100"
                  >
                    <option value="f16">f16 — Uncompressed (Full Precision)</option>
                    <option value="q8_0">q8_0 — 8-bit (50% savings, lossless quality)</option>
                    <option value="q4_0">q4_0 — 4-bit (75% savings, maximum context)</option>
                    <option value="q4_1">q4_1 — 4-bit with scale offset</option>
                    <option value="q5_0">q5_0 — 5-bit balanced quantization</option>
                    <option value="q5_1">q5_1 — 5-bit with scale offset</option>
                  </select>
                  <p className="text-2xs text-base-content/50">
                    Quantizes attention keys stored in VRAM.
                  </p>
                </div>

                {/* Value Cache Quantization (-ctv) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                    <span>V-Cache Type (-ctv)</span>
                    <span className="font-mono text-primary text-2xs">{config.cacheTypeV || 'q8_0'}</span>
                  </label>
                  <select
                    value={config.cacheTypeV || 'q8_0'}
                    onChange={(e) => {
                      setActivePreset('custom');
                      saveConfig({ cacheTypeV: e.target.value });
                    }}
                    className="select select-bordered select-sm w-full font-mono text-xs bg-base-100"
                  >
                    <option value="f16">f16 — Uncompressed (Full Precision)</option>
                    <option value="q8_0">q8_0 — 8-bit (50% savings, lossless quality)</option>
                    <option value="q4_0">q4_0 — 4-bit (75% savings, maximum context)</option>
                    <option value="q4_1">q4_1 — 4-bit with scale offset</option>
                    <option value="q5_0">q5_0 — 5-bit balanced quantization</option>
                    <option value="q5_1">q5_1 — 5-bit with scale offset</option>
                  </select>
                  <p className="text-2xs text-base-content/50">
                    Quantizes attention values stored in VRAM.
                  </p>
                </div>

                {/* Smart Prompt Cache Reuse (--cache-reuse) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                    <span>Prompt Cache Reuse</span>
                    <span className="font-mono text-primary text-2xs">{config.cacheReuse || 256} tokens</span>
                  </label>
                  <select
                    value={config.cacheReuse || 256}
                    onChange={(e) => {
                      setActivePreset('custom');
                      saveConfig({ cacheReuse: parseInt(e.target.value, 10) });
                    }}
                    className="select select-bordered select-sm w-full font-mono text-xs bg-base-100"
                  >
                    <option value="0">0 — Disabled (No KV reuse)</option>
                    <option value="128">128 tokens — Lightweight prefix</option>
                    <option value="256">256 tokens — Standard system prompt</option>
                    <option value="512">512 tokens — Large system prompt</option>
                    <option value="1024">1024 tokens — Extended persona prefix</option>
                  </select>
                  <p className="text-2xs text-base-content/50">
                    Retains common prompt prefixes across conversation turns.
                  </p>
                </div>

              </div>
            </div>

            {/* Subsection 2: Consolidated Batch Pipeline & Ingestion */}
            <div className="bg-base-300/40 p-4 rounded-xl border border-base-300 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-base-300/60">
                <div className="flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-primary" />
                  <span className="font-bold text-xs text-white">Unified Prompt Evaluation &amp; Batching Pipeline</span>
                </div>
                <span className="badge badge-primary badge-outline badge-2xs font-mono">
                  Engine Rule: -ub ≤ -b
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Logical Prompt Batch (-b) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <strong>Prompt Batch Size (-b)</strong>
                      <span className="text-2xs text-base-content/50 font-normal">Logical Ingest</span>
                    </span>
                    <span className="font-mono text-primary font-bold text-xs">{config.batchSize || 512} tokens</span>
                  </label>
                  <select
                    value={config.batchSize || 512}
                    onChange={(e) => {
                      const newB = parseInt(e.target.value, 10);
                      const currentUb = config.uBatchSize || 512;
                      const clampedUb = Math.min(currentUb, newB);
                      setActivePreset('custom');
                      saveConfig({ batchSize: newB, uBatchSize: clampedUb });
                    }}
                    className="select select-bordered select-sm w-full font-mono text-xs bg-base-100"
                  >
                    <option value="128">128 tokens — Low memory footprint</option>
                    <option value="256">256 tokens — Moderate prompt evaluation</option>
                    <option value="512">512 tokens — Standard balanced ingest</option>
                    <option value="1024">1024 tokens — High prompt processing speed</option>
                    <option value="2048">2048 tokens — Ultra high throughput</option>
                    <option value="4096">4096 tokens — Maximum ingest capacity</option>
                  </select>
                  <p className="text-2xs text-base-content/50">
                    Defines the total token block size evaluated simultaneously per prompt step.
                  </p>
                </div>

                {/* Physical Micro-Batch (-ub) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-base-content/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <strong>Micro-Batch Size (-ub)</strong>
                      <span className="text-2xs text-base-content/50 font-normal">Physical Compute</span>
                    </span>
                    <span className="font-mono text-primary font-bold text-xs">{config.uBatchSize || 512} tokens</span>
                  </label>
                  <select
                    value={config.uBatchSize || 512}
                    onChange={(e) => {
                      const newUb = parseInt(e.target.value, 10);
                      const currentB = config.batchSize || 512;
                      const expandedB = Math.max(currentB, newUb);
                      setActivePreset('custom');
                      saveConfig({ uBatchSize: newUb, batchSize: expandedB });
                    }}
                    className="select select-bordered select-sm w-full font-mono text-xs bg-base-100"
                  >
                    <option value="128">128 tokens — Minimal memory burst</option>
                    <option value="256">256 tokens — Low VRAM consumption</option>
                    <option value="512">512 tokens — Balanced GPU kernel chunk</option>
                    <option value="1024">1024 tokens — Fast GPU tensor execution</option>
                    <option value="2048">2048 tokens — Maximum hardware saturation</option>
                  </select>
                  <p className="text-2xs text-base-content/50">
                    Limits individual GPU kernel pass chunk size to avoid VRAM allocation spikes.
                  </p>
                </div>

              </div>

              <div className="text-2xs text-base-content/60 font-mono bg-base-200/60 p-2.5 rounded-lg border border-base-300 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>llama.cpp Execution Pipeline:</strong> <code className="text-white">-b</code> determines how many prompt tokens are evaluated per iteration. <code className="text-white">-ub</code> breaks those tokens into smaller physical chunks on the GPU to prevent VRAM spikes. Setting <code className="text-primary">-ub ≤ -b</code> is strictly enforced by the runner.
                </span>
              </div>
            </div>

            {/* Subsection 3: Toggles & Behavior Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              
              {/* Context Shifting Toggle */}
              <div className="bg-base-300/40 p-4 rounded-lg border border-base-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">Context Shifting</span>
                  <input
                    type="checkbox"
                    checked={config.ctxShift ?? true}
                    onChange={(e) => {
                      setActivePreset('custom');
                      saveConfig({ ctxShift: e.target.checked });
                    }}
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                </div>
                <p className="text-2xs text-base-content/60 leading-relaxed">
                  Automatically discards older conversation history when context limit is reached so the server never crashes or stops generating.
                </p>
              </div>

              {/* Flash Attention Toggle */}
              <div className="bg-base-300/40 p-4 rounded-lg border border-base-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">Flash Attention (-fa)</span>
                  <input
                    type="checkbox"
                    checked={config.flashAttn ?? true}
                    onChange={(e) => {
                      setActivePreset('custom');
                      saveConfig({ flashAttn: e.target.checked });
                    }}
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                </div>
                <p className="text-2xs text-base-content/60 leading-relaxed">
                  Hardware-accelerated attention calculation. Prevents quadratic memory explosion during large prompt evaluation.
                </p>
              </div>

              {/* RoPE Context Scaling */}
              <div className="bg-base-300/40 p-4 rounded-lg border border-base-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">RoPE Scaling</span>
                  <span className="badge badge-primary badge-outline badge-xs font-mono uppercase">
                    {config.ropeScaling || 'none'}
                  </span>
                </div>
                <select
                  value={config.ropeScaling || 'none'}
                  onChange={(e) => {
                    const mode = e.target.value;
                    setActivePreset('custom');
                    saveConfig({ 
                      ropeScaling: mode,
                      ropeScale: mode === 'yarn' ? 2.0 : mode === 'linear' ? 2.0 : 1.0 
                    });
                  }}
                  className="select select-bordered select-xs w-full font-mono text-2xs bg-base-100"
                >
                  <option value="none">None — Native context frequency</option>
                  <option value="yarn">YaRN — Modern 2x-4x context expansion</option>
                  <option value="linear">Linear — Standard frequency interpolation</option>
                </select>
                <p className="text-2xs text-base-content/60 leading-relaxed">
                  Interpolates positional embeddings to query beyond the model's native training context window.
                </p>
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
