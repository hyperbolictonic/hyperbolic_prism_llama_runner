import React from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Cpu, HardDrive, CheckCircle, Radio } from 'lucide-react';

export default function StatusBar() {
  const { serverStatus, config, systemInfo, localModels } = useApp();

  const isRunning = serverStatus.running;
  const isStarting = serverStatus.starting;
  const activeModel = localModels.find(m => m.path === config.selectedModel);
  const modelShortName = activeModel 
    ? activeModel.name 
    : (config.selectedModel ? config.selectedModel.split(/[\\/]/).pop() : 'None');

  return (
    <footer className="bg-base-200/90 border-t border-base-300 px-4 py-1.5 flex items-center justify-between text-2xs font-mono text-base-content/70 shrink-0 z-40 select-none">
      
      {/* Left: Server state & address */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isRunning ? 'running' : isStarting ? 'starting' : 'stopped'}`} />
          <span className="text-white font-medium">
            {isRunning ? `Online :${serverStatus.port || config.port}` : isStarting ? 'Starting...' : 'Offline'}
          </span>
        </div>

        <span className="opacity-30">|</span>

        <div className="flex items-center gap-1.5 truncate max-w-xs" title={config.selectedModel}>
          <HardDrive className="w-3 h-3 text-primary shrink-0" />
          <span className="truncate">{modelShortName}</span>
        </div>
      </div>

      {/* Right: Hardware & Quant format */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-primary shrink-0" />
          <span>{config.nGl > 0 ? `GPU (${config.nGl}L)` : 'CPU'}</span>
        </div>

        <span className="opacity-30">|</span>

        <div className="flex items-center gap-1.5" title="KV Cache Quantization & Context Size">
          <span className="text-primary font-semibold">KV: {config.cacheTypeK ? config.cacheTypeK.toUpperCase() : 'Q8_0'}</span>
          <span>({config.ctxSize >= 1024 ? `${config.ctxSize / 1024}K` : config.ctxSize})</span>
        </div>

        <span className="opacity-30">|</span>

        <div className="flex items-center gap-1.5">
          <span className="badge badge-primary badge-outline badge-xs font-mono text-2xs">
            {activeModel?.quant || 'GGUF / BitNet'}
          </span>
          <span className="opacity-60">UTF-8</span>
        </div>
      </div>

    </footer>
  );
}
