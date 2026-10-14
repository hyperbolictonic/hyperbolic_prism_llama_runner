import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AppContext = createContext(null);

export const UNIFIED_PRESETS = [
  {
    id: 'balanced',
    name: 'Studio Balanced (Q8_0)',
    shortName: 'Balanced',
    desc: 'LM Studio / Atomic Chat standard. 50% KV cache savings, lossless quality, balanced GPU offload.',
    badge: 'Recommended',
    badgeColor: 'badge-primary',
    kvType: 'Q8_0',
    ctxTarget: '16K',
  },
  {
    id: 'max-context',
    name: 'Max Context (Q4_0)',
    shortName: 'Max Context',
    desc: '75% KV VRAM savings. Enables 32K–256K massive context on consumer GPUs.',
    badge: 'Max Context',
    badgeColor: 'badge-secondary',
    kvType: 'Q4_0',
    ctxTarget: '64K–256K',
  },
  {
    id: 'fidelity',
    name: 'High Fidelity (F16)',
    shortName: 'High Fidelity',
    desc: 'Uncompressed cache. Pristine mathematical reasoning, logic, and code generation.',
    badge: '100% Precision',
    badgeColor: 'badge-neutral',
    kvType: 'F16',
    ctxTarget: '8K',
  },
  {
    id: 'extreme',
    name: 'Extended RoPE (YaRN)',
    shortName: 'Extended RoPE',
    desc: 'Scales context beyond native window using YaRN scaling and controlled micro-batching.',
    badge: 'YaRN Extended',
    badgeColor: 'badge-accent',
    kvType: 'Q4_0 + YaRN',
    ctxTarget: '128K+',
  },
];

export function AppProvider({ children }) {
  const [activeTab, setActiveTab] = useState('runner');
  const [activePreset, setActivePreset] = useState('balanced');
  const [config, setConfig] = useState({
    host: '127.0.0.1',
    port: 8080,
    ctxSize: 8192,
    nGl: 0,
    threads: 8,
    batchSize: 512,
    uBatchSize: 512,
    modelsDir: 'models',
    flashAttn: true,
    jinja: true,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
    ctxShift: true,
    cacheReuse: 256,
    ropeScaling: 'none',
    ropeScale: 1.0,
    selectedModel: '',
    selectedMmproj: '',
    binaryPath: '',
    extraArgs: '',
  });

  const [systemInfo, setSystemInfo] = useState({ cpuModel: '', cpuCores: 8, gpus: [] });
  const [serverStatus, setServerStatus] = useState({
    running: false,
    starting: false,
    pid: null,
    host: '127.0.0.1',
    port: 8080,
    model: '',
    uptime: 0,
  });

  const [localModels, setLocalModels] = useState([]);
  const [hubModels, setHubModels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [modalRepo, setModalRepo] = useState(null);
  const [modalFiles, setModalFiles] = useState([]);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Initial Data Fetch & Push Listeners
  useEffect(() => {
    async function loadInitial() {
      if (typeof window.tiny === 'undefined') return;

      try {
        const sys = await window.tiny.api.call('getSystemInfo');
        if (sys) setSystemInfo(sys);
      } catch (e) {
        console.error('getSystemInfo failed:', e);
      }

      try {
        const cfg = await window.tiny.api.call('getConfig');
        if (cfg) setConfig(prev => ({ ...prev, ...cfg }));
      } catch (e) {
        console.error('getConfig failed:', e);
      }

      try {
        const st = await window.tiny.api.call('getServerStatus');
        if (st) setServerStatus(prev => ({ ...prev, ...st }));
      } catch (e) {}

      try {
        const lg = await window.tiny.api.call('getServerLogs');
        if (lg) setLogs(lg);
      } catch (e) {}

      refreshLocalModels();
      searchHub('prism-ml');
    }

    loadInitial();

    if (typeof window.tiny !== 'undefined' && window.tiny.api) {
      window.tiny.api.on('server-log', (data) => {
        if (data && data.line) {
          setLogs(prev => {
            const next = [...prev, data.line];
            if (next.length > 3000) next.shift();
            return next;
          });
        }
      });

      window.tiny.api.on('server-status', (data) => {
        if (data) setServerStatus(prev => ({ ...prev, ...data }));
      });

      window.tiny.api.on('server-uptime', (data) => {
        if (data && data.uptime !== undefined) {
          setServerStatus(prev => ({ ...prev, uptime: data.uptime }));
        }
      });

      window.tiny.api.on('download-progress', (event) => {
        if (!event) return;
        if (event.type === 'start') {
          setDownloadInfo({ filename: event.info.filename, progress: 10, meta: 'Starting download...' });
        } else if (event.type === 'progress') {
          setDownloadInfo({
            filename: event.info.filename,
            progress: 50,
            meta: `${event.info.downloadedFormatted} · ${event.info.speed}`,
          });
        } else if (event.type === 'complete') {
          setDownloadInfo({
            filename: event.info.filename,
            progress: 100,
            meta: `Completed (${event.info.downloadedFormatted})!`,
          });
          setTimeout(() => setDownloadInfo(null), 2500);
          refreshLocalModels();
          if (window.tiny.dialog) {
            window.tiny.dialog.alert('Download Finished', `Model ${event.info.filename} is downloaded and ready!`);
          }
        } else if (event.type === 'cancelled' || event.type === 'error') {
          setDownloadInfo(null);
        }
      });
    }
  }, []);

  async function refreshLocalModels() {
    if (typeof window.tiny === 'undefined') return;
    try {
      const list = await window.tiny.api.call('listLocalModels');
      setLocalModels(list || []);
    } catch (e) {
      console.error('listLocalModels failed:', e);
    }
  }

  async function searchHub(query = 'prism-ml') {
    if (typeof window.tiny === 'undefined') return;
    try {
      const res = await window.tiny.api.call('searchHuggingFace', { query });
      setHubModels(res || []);
    } catch (e) {
      console.error('searchHuggingFace failed:', e);
    }
  }

  async function startServer() {
    if (typeof window.tiny === 'undefined') return;
    if (!config.selectedModel) {
      window.tiny.dialog.alert('No Model Selected', 'Please select a .gguf model in Model Manager before starting the inference server.');
      return;
    }
    setServerStatus(prev => ({ ...prev, starting: true }));
    try {
      const res = await window.tiny.api.call('startServer', config);
      setServerStatus(prev => ({ ...prev, ...res, starting: false }));
    } catch (e) {
      window.tiny.dialog.alert('Failed to Start Server', e.message);
      setServerStatus(prev => ({ ...prev, running: false, starting: false }));
    }
  }

  async function stopServer() {
    if (typeof window.tiny === 'undefined') return;
    try {
      const res = await window.tiny.api.call('stopServer');
      setServerStatus(prev => ({ ...prev, ...res, starting: false }));
    } catch (e) {
      window.tiny.dialog.alert('Error', e.message);
    }
  }

  async function restartServer() {
    await stopServer();
    setTimeout(() => startServer(), 600);
  }

  async function saveConfig(updates) {
    if (typeof window.tiny === 'undefined') return;
    const next = { ...config, ...updates };
    setConfig(next);
    try {
      await window.tiny.api.call('saveConfig', next);
      if (updates.modelsDir) {
        refreshLocalModels();
      }
    } catch (e) {
      console.error('saveConfig failed:', e);
    }
  }

  async function selectModel(filePath) {
    await saveConfig({ selectedModel: filePath });
    refreshLocalModels();
  }

  async function selectMmproj(filePath) {
    await saveConfig({ selectedMmproj: filePath });
    refreshLocalModels();
  }

  async function deleteModel(filePath, filename) {
    if (confirm(`Are you sure you want to delete ${filename}? This cannot be undone.`)) {
      try {
        await window.tiny.api.call('deleteModel', { path: filePath });
        refreshLocalModels();
      } catch (e) {
        window.tiny.dialog.alert('Delete Failed', e.message);
      }
    }
  }

  async function openInExplorer(filePath) {
    if (typeof window.tiny === 'undefined') return;
    try {
      await window.tiny.api.call('openInExplorer', { path: filePath });
    } catch (e) {
      window.tiny.dialog.alert('Error', e.message);
    }
  }

  async function openRepoModal(repoId) {
    setModalRepo(repoId);
    setIsModalLoading(true);
    setModalFiles([]);
    try {
      const files = await window.tiny.api.call('getHfModelFiles', { repoId });
      setModalFiles(files || []);
    } catch (e) {
      console.error('getHfModelFiles failed:', e);
    } finally {
      setIsModalLoading(false);
    }
  }

  function closeRepoModal() {
    setModalRepo(null);
    setModalFiles([]);
  }

  async function downloadHfFile(repoId, filename, downloadUrl) {
    closeRepoModal();
    try {
      await window.tiny.api.call('downloadHfFile', { repoId, filename, downloadUrl });
    } catch (e) {
      window.tiny.dialog.alert('Download Error', e.message);
    }
  }

  async function cancelDownload() {
    try {
      await window.tiny.api.call('cancelHfDownload');
      setDownloadInfo(null);
    } catch (e) {}
  }

  async function clearLogs() {
    setLogs([]);
    try {
      await window.tiny.api.call('clearServerLogs');
    } catch (e) {}
  }

  function applyGlobalPreset(presetKey) {
    setActivePreset(presetKey);
    const cores = systemInfo?.cpuCores || 8;
    const activeModel = localModels.find(m => m.path === config.selectedModel || m.name === config.selectedModel);
    const modelNativeMax = (activeModel && activeModel.maxContext) ? activeModel.maxContext : 262144;

    if (presetKey === 'fidelity') {
      saveConfig({
        cacheTypeK: 'f16',
        cacheTypeV: 'f16',
        ctxSize: Math.min(8192, modelNativeMax),
        nGl: 32,
        threads: Math.max(4, Math.floor(cores / 2)),
        batchSize: 512,
        uBatchSize: 512,
        flashAttn: true,
        ctxShift: true,
        cacheReuse: 256,
        ropeScaling: 'none',
        ropeScale: 1.0,
      });
    } else if (presetKey === 'balanced') {
      saveConfig({
        cacheTypeK: 'q8_0',
        cacheTypeV: 'q8_0',
        ctxSize: Math.min(16384, modelNativeMax),
        nGl: 28,
        threads: Math.max(4, Math.floor(cores / 2)),
        batchSize: 512,
        uBatchSize: 512,
        flashAttn: true,
        ctxShift: true,
        cacheReuse: 256,
        ropeScaling: 'none',
        ropeScale: 1.0,
      });
    } else if (presetKey === 'max-context') {
      const targetCtx = Math.min(modelNativeMax, 65536);
      saveConfig({
        cacheTypeK: 'q4_0',
        cacheTypeV: 'q4_0',
        ctxSize: targetCtx,
        nGl: 24,
        threads: 8,
        batchSize: 1024,
        uBatchSize: 512,
        flashAttn: true,
        ctxShift: true,
        cacheReuse: 512,
        ropeScaling: 'none',
        ropeScale: 1.0,
      });
    } else if (presetKey === 'extreme') {
      const targetExtreme = Math.max(65536, modelNativeMax);
      saveConfig({
        cacheTypeK: 'q4_0',
        cacheTypeV: 'q4_0',
        ctxSize: targetExtreme,
        nGl: 20,
        threads: 8,
        batchSize: 1024,
        uBatchSize: 256,
        flashAttn: true,
        ctxShift: true,
        cacheReuse: 512,
        ropeScaling: 'yarn',
        ropeScale: 2.0,
      });
    }
  }

  return (
    <AppContext.Provider value={{
      activeTab,
      setActiveTab,
      activePreset,
      setActivePreset,
      applyGlobalPreset,
      config,
      systemInfo,
      serverStatus,
      localModels,
      hubModels,
      logs,
      downloadInfo,
      modalRepo,
      modalFiles,
      isModalLoading,
      startServer,
      stopServer,
      restartServer,
      saveConfig,
      selectModel,
      selectMmproj,
      deleteModel,
      openInExplorer,
      refreshLocalModels,
      searchHub,
      openRepoModal,
      closeRepoModal,
      downloadHfFile,
      cancelDownload,
      clearLogs,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
