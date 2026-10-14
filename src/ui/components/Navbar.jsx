import React from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Play, Square, RotateCw, Search } from 'lucide-react';

export default function Navbar() {
  const { serverStatus, config, startServer, stopServer, restartServer, setActiveTab } = useApp();

  const isRunning = serverStatus.running;
  const isStarting = serverStatus.starting;
  const modelName = config.selectedModel
    ? config.selectedModel.replace(/\\/g, '/').split('/').pop()
    : 'No model selected';

  return (
    <header className="navbar bg-base-200 border-b border-base-300 px-4 min-h-[50px] shrink-0 z-50 flex justify-between items-center" data-tiny-drag>
      
      {/* Brand & Product */}
      <div className="flex items-center gap-3">
        <div className="text-primary flex items-center">
          <Terminal className="w-5 h-5 text-primary stroke-[2.5]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tracking-wide text-sm">Prism Bonsai</span>
          <span className="opacity-40 text-xs">—</span>
          <span className="text-xs text-base-content/80 font-medium">llama.cpp Runner &amp; Hub</span>
          <span className="badge badge-primary badge-outline badge-xs font-mono ml-1">1-bit / Ternary</span>
        </div>
      </div>

      {/* Quick Model Selector Bar (Centered) */}
      <div className="flex-1 max-w-md mx-6" data-tiny-nodrag>
        <div
          onClick={() => setActiveTab('models')}
          className="input input-bordered input-sm bg-base-100 flex items-center gap-2 cursor-pointer shadow-inner hover:border-primary transition-colors"
          title="Click to select or change model"
        >
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <span className="truncate flex-1 font-mono text-xs opacity-80">{modelName}</span>
          <kbd className="kbd kbd-xs font-mono opacity-60">Ctrl+P</kbd>
        </div>
      </div>

      {/* Quick Server Controls (Right) */}
      <div className="flex items-center gap-3" data-tiny-nodrag>
        <div className="badge badge-neutral gap-2 py-3 px-3 font-mono text-xs border border-base-300">
          <span
            className={`status-dot ${isRunning ? 'running' : isStarting ? 'starting' : 'stopped'}`}
          />
          <span>{isRunning ? 'Online' : isStarting ? 'Starting...' : 'Stopped'}</span>
        </div>

        {isRunning ? (
          <button
            onClick={stopServer}
            className="btn btn-error btn-sm gap-2 font-bold shadow-md"
            title="Stop Inference Server"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop Server</span>
          </button>
        ) : (
          <button
            onClick={startServer}
            disabled={isStarting}
            className="btn btn-primary btn-sm gap-2 font-bold shadow-md"
            title="Start Inference Server"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Server</span>
          </button>
        )}

        <button
          onClick={restartServer}
          className="btn btn-ghost btn-sm btn-square"
          title="Restart Server"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

    </header>
  );
}
