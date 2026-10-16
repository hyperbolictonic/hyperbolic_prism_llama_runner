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
    badgeColor: 'badge-info',
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

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

  const [systemInfo, setSystemInfo] = useState({ cpuModel: '', cpuCores: 8, gpus: [], localIp: '127.0.0.1' });
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
        const info = event.info || {};
        const isBatch = info.batchTotal > 1;
        const prefix = isBatch ? `[Part ${info.batchIndex}/${info.batchTotal}] ` : '';

        const totalPart = info.totalFormatted ? ` of ${info.totalFormatted}` : '';

        if (event.type === 'start') {
          setDownloadInfo({
            filename: info.filename,
            progress: 5,
            meta: `${prefix}Connecting & starting download...`,
            speed: 'Connecting...',
            downloadedFormatted: '0 B',
            totalFormatted: info.totalFormatted || '',
            batchIndex: info.batchIndex,
            batchTotal: info.batchTotal,
          });
        } else if (event.type === 'progress') {
          setDownloadInfo({
            filename: info.filename,
            progress: info.progress || 0,
            meta: `${prefix}${info.downloadedFormatted}${totalPart} (${info.progress || 0}%) · ${info.speed}`,
            speed: info.speed,
            downloadedFormatted: info.downloadedFormatted,
            totalFormatted: info.totalFormatted || '',
            batchIndex: info.batchIndex,
            batchTotal: info.batchTotal,
          });
        } else if (event.type === 'item-complete') {
          setDownloadInfo({
            filename: info.filename,
            progress: 100,
            meta: `${prefix}Finished! Moving to next part...`,
            batchIndex: info.batchIndex,
            batchTotal: info.batchTotal,
          });
          refreshLocalModels();
        } else if (event.type === 'complete') {
          setDownloadInfo({
            filename: info.filename,
            progress: 100,
            meta: `All downloads complete (${info.downloadedFormatted})!`,
            batchIndex: info.batchIndex,
            batchTotal: info.batchTotal,
          });
          setTimeout(() => setDownloadInfo(null), 3500);
          refreshLocalModels();
          if (window.tiny.dialog) {
            const title = event.bundleCompleted ? 'Model & Vision Bundle Ready' : 'Download Complete';
            const msg = event.bundleCompleted
              ? `Both the model and matching vision projector have been downloaded and automatically configured!`
              : `Model ${info.filename} has finished downloading and is ready to use!`;
            window.tiny.dialog.alert(title, msg);
          }
        } else if (event.type === 'error') {
          setDownloadInfo(null);
          if (window.tiny && window.tiny.dialog) {
            window.tiny.dialog.alert('Download Failed', event.message || 'The download failed to start or was interrupted.');
          }
        } else if (event.type === 'cancelled') {
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

  async function startServer(overrideConfig = null) {
    if (typeof window.tiny === 'undefined') return;
    const isEvent = overrideConfig && (overrideConfig.nativeEvent || overrideConfig._reactName || overrideConfig.target || overrideConfig.bubbles !== undefined);
    const cfg = (!isEvent && overrideConfig && typeof overrideConfig === 'object')
      ? { ...config, ...overrideConfig }
      : config;

    if (!cfg.selectedModel) {
      window.tiny.dialog.alert('No Model Selected', 'Please select a .gguf model in Model Manager before starting the inference server.');
      return;
    }
    setServerStatus(prev => ({ ...prev, starting: true, running: false }));
    try {
      const res = await window.tiny.api.call('startServer', cfg);
      if (res && res.error) {
        window.tiny.dialog.alert('Failed to Start Server', res.error);
        setServerStatus(prev => ({ ...prev, running: false, starting: false }));
      } else if (res && res.message && !res.success) {
        window.tiny.dialog.alert('Server Notice', res.message);
        setServerStatus(prev => ({ ...prev, starting: false }));
      } else {
        setServerStatus(prev => ({ ...prev, ...res, starting: true }));
      }
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

  async function restartServer(overrideConfig = null) {
    const isEvent = overrideConfig && (overrideConfig.nativeEvent || overrideConfig._reactName || overrideConfig.target || overrideConfig.bubbles !== undefined);
    const cfg = (!isEvent && overrideConfig && typeof overrideConfig === 'object')
      ? { ...config, ...overrideConfig }
      : config;
    await stopServer();
    setTimeout(() => startServer(cfg), 800);
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
    const next = config.selectedMmproj === filePath ? '' : filePath;
    await saveConfig({ selectedMmproj: next });
    refreshLocalModels();
  }

  async function activateModelBundle(modelPath, mmprojPath = '') {
    await saveConfig({
      selectedModel: modelPath,
      selectedMmproj: mmprojPath || '',
    });
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

  async function openExternalUrl(url) {
    if (!url) return;
    if (typeof window.tiny !== 'undefined' && window.tiny.api) {
      try {
        await window.tiny.api.call('openExternalUrl', { url });
        return;
      } catch (e) {}
    }
    window.open(url, '_blank');
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

  async function downloadHfFile(repoId, filename, downloadUrl, sizeBytes) {
    if (!filename) return;
    const cleanFilename = filename.split('/').pop();

    setDownloadInfo({
      filename: cleanFilename,
      progress: 2,
      meta: `Connecting & downloading ${cleanFilename}...`,
      speed: 'Connecting...',
      downloadedFormatted: '0 B',
      totalFormatted: sizeBytes ? formatBytes(sizeBytes) : '',
      batchIndex: 1,
      batchTotal: 1,
    });

    try {
      await window.tiny.api.call('downloadHfFile', { 
        repoId, 
        filename, 
        downloadUrl,
        sizeBytes: sizeBytes || 0,
        autoSelectModel: !cleanFilename.toLowerCase().includes('mmproj'),
        autoSelectMmproj: cleanFilename.toLowerCase().includes('mmproj'),
      });
    } catch (e) {
      console.error('downloadHfFile error:', e);
      setDownloadInfo(null);
      if (typeof window.tiny !== 'undefined' && window.tiny.dialog) {
        window.tiny.dialog.alert('Download Error', e.message);
      } else {
        alert('Download Error: ' + e.message);
      }
    }
  }

  async function downloadHfBundle(repoId, modelFile, visionFile) {
    if (!modelFile) return;
    const cleanModelName = modelFile.filename.split('/').pop();

    // Instant optimistic state so the user immediately sees the download starting
    setDownloadInfo({
      filename: cleanModelName,
      parentModelFilename: cleanModelName,
      progress: 2,
      meta: visionFile 
        ? `[Part 1/2] Connecting & downloading ${cleanModelName}...`
        : `Connecting & downloading ${cleanModelName}...`,
      speed: 'Connecting...',
      downloadedFormatted: '0 B',
      totalFormatted: modelFile.sizeFormatted || (modelFile.sizeBytes ? formatBytes(modelFile.sizeBytes) : ''),
      batchIndex: 1,
      batchTotal: visionFile ? 2 : 1,
      isVisionBundle: Boolean(visionFile),
    });

    let bundleCallSuccess = false;
    if (typeof window.tiny !== 'undefined' && window.tiny.api) {
      try {
        const res = await window.tiny.api.call('downloadHfBundle', {
          files: [
            {
              repoId,
              filename: modelFile.filename,
              downloadUrl: modelFile.downloadUrl,
              sizeBytes: modelFile.sizeBytes || 0,
              autoSelectModel: true,
            },
            ...(visionFile ? [{
              repoId,
              filename: visionFile.filename,
              downloadUrl: visionFile.downloadUrl,
              sizeBytes: visionFile.sizeBytes || 0,
              autoSelectMmproj: true,
            }] : []),
          ],
        });
        if (res && res.success) {
          bundleCallSuccess = true;
        }
      } catch (err) {
        console.warn('downloadHfBundle IPC not registered or failed, falling back to sequential queue:', err);
      }
    }

    if (!bundleCallSuccess) {
      // Fallback: trigger sequential downloadHfFile calls
      try {
        await window.tiny.api.call('downloadHfFile', {
          repoId,
          filename: modelFile.filename,
          downloadUrl: modelFile.downloadUrl,
          sizeBytes: modelFile.sizeBytes || 0,
          autoSelectModel: true,
        });

        if (visionFile) {
          await window.tiny.api.call('downloadHfFile', {
            repoId,
            filename: visionFile.filename,
            downloadUrl: visionFile.downloadUrl,
            sizeBytes: visionFile.sizeBytes || 0,
            autoSelectMmproj: true,
          });
        }
      } catch (fallbackErr) {
        console.error('Fallback download failed:', fallbackErr);
        setDownloadInfo(null);
        if (typeof window.tiny !== 'undefined' && window.tiny.dialog) {
          window.tiny.dialog.alert('Download Failed', fallbackErr.message);
        } else {
          alert('Download Failed: ' + fallbackErr.message);
        }
      }
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

  async function toggleNetworkAccess() {
    const isCurrentlyLan = (config.host === '0.0.0.0');
    const targetHost = isCurrentlyLan ? '127.0.0.1' : '0.0.0.0';
    const next = { ...config, host: targetHost };
    await saveConfig({ host: targetHost });
    if (serverStatus.running) {
      await restartServer(next);
    }
  }

  async function setServerPort(portInput) {
    const targetPort = parseInt(portInput, 10) || 8080;
    const next = { ...config, port: targetPort };
    await saveConfig({ port: targetPort });
    if (serverStatus.running) {
      await restartServer(next);
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
      activateModelBundle,
      deleteModel,
      openInExplorer,
      openExternalUrl,
      refreshLocalModels,
      searchHub,
      openRepoModal,
      closeRepoModal,
      downloadHfFile,
      downloadHfBundle,
      cancelDownload,
      clearLogs,
      toggleNetworkAccess,
      setServerPort,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
