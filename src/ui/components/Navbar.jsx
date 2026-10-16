import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Play, Square, RotateCw, Search, Globe, Shield, Copy, Check } from 'lucide-react';

export default function Navbar() {
  const { serverStatus, config, systemInfo, startServer, stopServer, restartServer, setActiveTab, toggleNetworkAccess } = useApp();

  const [copiedLan, setCopiedLan] = useState(false);
  const isRunning = serverStatus.running;
  const isStarting = serverStatus.starting;
  const isLan = config.host === '0.0.0.0';
  const lanIp = systemInfo?.localIp || '127.0.0.1';
  const port = serverStatus.port || config.port || 8080;
  const modelName = config.selectedModel
    ? config.selectedModel.replace(/\\/g, '/').split('/').pop()
    : 'No model selected';

  const handleCopyLanUrl = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`http://${lanIp}:${port}/v1`);
    setCopiedLan(true);
    setTimeout(() => setCopiedLan(false), 2000);
  };

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
        {/* Network LAN Access Toggle */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-md border transition-all text-xs ${
            isLan
              ? 'bg-primary/10 border-primary/40 text-white shadow-sm'
              : 'bg-base-100/60 border-base-300 text-base-content/70'
          }`}
          title={isLan
            ? `LAN Access ON: listening on 0.0.0.0 (Connect from network via http://${lanIp}:${port})`
            : 'Localhost Only: listening on 127.0.0.1 (Blocked from other network nodes)'}
        >
          <div className="flex items-center gap-1.5 font-mono select-none">
            {isLan ? (
              <Globe className="w-3.5 h-3.5 text-primary animate-pulse" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-base-content/50" />
            )}
            <span className="text-2xs font-semibold">
              {isLan ? 'LAN Mode' : 'Local Only'}
            </span>
          </div>

          <input
            type="checkbox"
            className="toggle toggle-primary toggle-xs cursor-pointer"
            checked={isLan}
            onChange={toggleNetworkAccess}
            aria-label="Toggle Network LAN Access"
          />

          {isLan && (
            <button
              onClick={handleCopyLanUrl}
              className="badge badge-primary badge-outline badge-xs font-mono text-2xs gap-1 hover:bg-primary hover:text-black transition-colors cursor-pointer ml-0.5"
              title="Click to copy network endpoint URL"
            >
              {copiedLan ? (
                <>
                  <Check className="w-2.5 h-2.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5 opacity-60" />
                  <span>{lanIp}:{port}</span>
                </>
              )}
            </button>
          )}
        </div>

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
            {isStarting ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Server</span>
              </>
            )}
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
