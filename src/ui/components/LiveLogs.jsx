import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Terminal, 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  Filter, 
  ArrowDownCircle,
  Radio
} from 'lucide-react';

export default function LiveLogs() {
  const { logs, clearLogs } = useApp();
  
  const [filterLevel, setFilterLevel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const terminalEndRef = useRef(null);

  // Filter logs memoized for performance
  const filteredLogs = useMemo(() => {
    return logs.filter((line) => {
      if (filterLevel === 'error' && !/error|fatal|fail/i.test(line)) return false;
      if (filterLevel === 'warn' && !/warn/i.test(line)) return false;
      if (filterLevel === 'info' && /error|warn/i.test(line)) return false;
      if (searchQuery && !line.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [logs, filterLevel, searchQuery]);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-base-100 p-6 overflow-hidden">
      
      {/* Terminal Container */}
      <div className="card bg-base-200 border border-base-300 shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
        
        {/* Header Controls */}
        <div className="p-4 bg-base-300/40 border-b border-base-300 flex flex-wrap items-center justify-between gap-4 shrink-0">
          
          {/* Title & Live Status */}
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-white">Live llama-server Output</h2>
                <div className="badge badge-neutral gap-1.5 py-1 px-2 text-2xs font-mono border border-base-300">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Real-time Stream</span>
                </div>
              </div>
              <p className="text-2xs text-base-content/60 font-mono">
                Captures standard output &amp; stderr from the inference engine process.
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            
            <label className="input input-bordered input-xs bg-base-100 flex items-center gap-1.5 w-48">
              <Search className="w-3 h-3 opacity-50 shrink-0" />
              <input
                type="text"
                placeholder="Search log lines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="grow font-mono text-2xs"
              />
            </label>

            <div className="flex items-center gap-1 bg-base-100 p-0.5 rounded-lg border border-base-300">
              {[
                { id: 'all', label: 'All' },
                { id: 'info', label: 'Info' },
                { id: 'warn', label: 'Warnings' },
                { id: 'error', label: 'Errors' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterLevel(f.id)}
                  className={`btn btn-xs px-2.5 font-semibold text-2xs ${
                    filterLevel === f.id ? 'btn-primary text-black font-bold' : 'btn-ghost text-base-content/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="label cursor-pointer gap-2 p-0">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="checkbox checkbox-primary checkbox-xs"
              />
              <span className="label-text text-2xs font-mono text-base-content/80">Auto-scroll</span>
            </label>

            <button
              onClick={handleCopyLogs}
              className="btn btn-outline btn-neutral btn-xs gap-1"
              title="Copy all logs to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={clearLogs}
              className="btn btn-outline btn-neutral btn-xs gap-1 text-base-content/70 hover:text-error"
              title="Clear terminal window"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>

          </div>

        </div>

        {/* Log Lines Output Window */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-[#0a0e14] select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-base-content/40 space-y-1">
              <div>Waiting for engine events...</div>
              <div className="text-2xs">Logs will stream here automatically when the server runs or downloads occur.</div>
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const isError = /error|fatal|fail/i.test(line);
              const isWarn = /warn/i.test(line);
              const isEval = /slot|prompt eval|eval time|tokens per second|t\/s/i.test(line);

              let colorClass = 'text-base-content/70';
              if (isError) colorClass = 'text-error font-semibold';
              else if (isWarn) colorClass = 'text-warning';
              else if (isEval) colorClass = 'text-primary font-medium';

              return (
                <div key={idx} className={`py-0.5 break-all ${colorClass}`}>
                  {line}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer Info */}
        <div className="px-4 py-2 bg-base-300/40 border-t border-base-300 flex justify-between items-center text-2xs font-mono text-base-content/60 shrink-0">
          <div>
            Showing {filteredLogs.length} of {logs.length} logged events
          </div>
          <div className="flex items-center gap-2">
            <span>Buffer limit: 3,000 lines</span>
          </div>
        </div>

      </div>

    </div>
  );
}
