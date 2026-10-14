// State and Helpers Module
export const $ = (id) => document.getElementById(id);

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const appState = {
  config: {},
  systemInfo: {},
  serverStatus: { running: false, starting: false, pid: null, host: '127.0.0.1', port: 8080, model: '', uptime: 0 },
  localModels: [],
  hubModels: [],
  logs: [],
  chatHistory: [],
  logFilter: 'all',
  logSearchQuery: '',
  isGenerating: false,
  chatAbortController: null,
};

export function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
