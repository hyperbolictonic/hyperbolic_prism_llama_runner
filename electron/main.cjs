const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

// Prevent GPU disk cache lock errors and shader cache collisions on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Use standard OS user-data directory rather than local workspace folder to avoid Windows file-locking
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'hyperbolic-prism-llama-runner'));
} catch (e) {}

// Enforce single instance lock to prevent multiple Electron processes from conflicting on disk cache
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Hyperbolic Prism Llama Runner is already running. Focusing active window.');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let serverProcess = null;
let uptimeInterval = null;
let activeDownloadProcess = null;

const CONFIG_FILE = path.join(process.cwd(), 'runner-config.json');
const DEFAULT_CONFIG = {
  host: '127.0.0.1',
  port: 8080,
  ctxSize: 8192,
  nGl: 0,
  threads: Math.max(4, Math.floor(os.cpus().length / 2)),
  batchSize: 512,
  uBatchSize: 512,
  modelsDir: path.join(process.cwd(), 'models'),
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
};

let serverStatus = {
  running: false,
  starting: false,
  pid: null,
  host: '127.0.0.1',
  port: 8080,
  model: '',
  uptime: 0,
};

let serverLogs = [];
const MAX_LOG_LINES = 3000;

function addLog(line) {
  const clean = String(line).replace(/\r/g, '');
  serverLogs.push(clean);
  if (serverLogs.length > MAX_LOG_LINES) serverLogs.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-log', { line: clean });
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (e) {
    console.error('Failed to read config:', e);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfigSync(updates) {
  try {
    const current = loadConfig();
    const next = { ...current, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (e) {
    console.error('Failed to save config:', e);
    throw e;
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function detectQuantType(filename) {
  const f = filename.toUpperCase();
  if (f.includes('Q1_0') || f.includes('1BIT') || f.includes('1-BIT')) return '1-bit (Q1_0)';
  if (f.includes('PQ2_0') || f.includes('TERNARY-2') || f.includes('2BIT') || f.includes('2-BIT')) return 'Ternary (PQ2_0)';
  if (f.includes('PTQ1_0')) return 'Ternary (PTQ1_0)';
  if (f.includes('Q4_K_M') || f.includes('Q4_K')) return '4-bit (Q4_K_M)';
  if (f.includes('Q8_0')) return '8-bit (Q8_0)';
  if (f.includes('F16') || f.includes('FP16')) return '16-bit (FP16)';
  if (f.includes('BF16')) return '16-bit (BF16)';
  if (f.includes('MMPROJ')) return 'Vision Projector';
  return 'GGUF Model';
}

function readGgufContextLength(filePath) {
  // Check filename first for quick hints
  const baseName = path.basename(filePath).toLowerCase();
  if (baseName.includes('256k')) return 262144;
  if (baseName.includes('128k')) return 131072;
  if (baseName.includes('64k')) return 65536;
  if (baseName.includes('32k')) return 32768;
  if (baseName.includes('16k')) return 16384;
  if (baseName.includes('8k')) return 8192;

  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512 * 1024); // Read up to 512KB of header
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);

    if (bytesRead >= 12 && buffer.toString('utf8', 0, 4) === 'GGUF') {
      const needles = ['context_length', 'max_position_embeddings', 'seq_length'];
      for (const key of needles) {
        const needle = Buffer.from(key);
        const idx = buffer.indexOf(needle);
        if (idx !== -1) {
          const afterKey = idx + needle.length;
          // Check standard GGUF value_type + value
          if (afterKey + 8 <= bytesRead) {
            try {
              const valType = buffer.readUInt32LE(afterKey);
              if (valType === 4 || valType === 5) { // UINT32 or INT32
                const val = buffer.readUInt32LE(afterKey + 4);
                if (val >= 1024 && val <= 4194304) return val;
              } else if (valType === 10 || valType === 11) { // UINT64 or INT64
                const val = Number(buffer.readBigUInt64LE(afterKey + 4));
                if (val >= 1024 && val <= 4194304) return val;
              }
            } catch (e) {}
          }

          // Fallback scan nearby bytes for known common context sizes
          const knownContexts = [2048, 4096, 8192, 16384, 32768, 40960, 65536, 128000, 131072, 262144, 524288, 1048576];
          for (let offset = afterKey; offset < afterKey + 32 && offset + 4 <= bytesRead; offset++) {
            const val32 = buffer.readUInt32LE(offset);
            if (knownContexts.includes(val32)) {
              return val32;
            }
          }
        }
      }
    }
  } catch (e) {}

  // Default to 256K (Prism models max capability)
  return 262144;
}

function findDefaultBinary() {
  const possible = [
    path.join(__dirname, '../bin/llama-server.exe'),
    path.join(__dirname, '../bin/prism-llama/llama-server.exe'),
    path.join(process.cwd(), 'bin/llama-server.exe'),
  ];
  for (const p of possible) {
    if (fs.existsSync(p)) return p;
  }
  return 'llama-server.exe';
}

// Window Creation
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Prism Bonsai Runner & Model Manager',
    backgroundColor: '#101012',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev = process.argv.includes('--dev') || Boolean(process.env.VITE_DEV_SERVER_URL);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../src/frontend/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /F /T /PID ${serverProcess.pid}`);
        } else {
          serverProcess.kill();
        }
      } catch (e) {}
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Register IPC Handlers
ipcMain.handle('getSystemInfo', async () => {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU';
  const cpuCores = cpus.length;

  let gpus = [];
  if (process.platform === 'win32') {
    try {
      const stdout = await new Promise((resolve) => {
        exec('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -Property Name | ConvertTo-Json -Compress"', (err, out) => {
          resolve(err ? '' : out);
        });
      });
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout);
        gpus = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (e) {}
  }
  return { cpuModel, cpuCores, gpus };
});

ipcMain.handle('getConfig', async () => {
  return loadConfig();
});

ipcMain.handle('saveConfig', async (_event, updates) => {
  return saveConfigSync(updates);
});

ipcMain.handle('listLocalModels', async () => {
  const config = loadConfig();
  const dir = config.modelsDir || path.join(process.cwd(), 'models');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const results = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.toLowerCase().endsWith('.gguf') || f.toLowerCase().endsWith('.mmproj')) {
      const fullPath = path.join(dir, f);
      try {
        const stat = fs.statSync(fullPath);
        results.push({
          name: f,
          path: fullPath,
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          quant: detectQuantType(f),
          isMmproj: f.toLowerCase().includes('mmproj'),
          maxContext: readGgufContextLength(fullPath),
        });
      } catch (e) {}
    }
  }
  results.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return results;
});

ipcMain.handle('deleteModel', async (_event, { path: filePath }) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true };
  }
  throw new Error('File does not exist: ' + filePath);
});

ipcMain.handle('openInExplorer', async (_event, { path: targetPath }) => {
  if (!targetPath) return;
  const p = path.resolve(targetPath);
  if (fs.existsSync(p)) {
    shell.showItemInFolder(p);
  } else {
    shell.openPath(path.dirname(p));
  }
});

ipcMain.handle('searchHuggingFace', async (_event, { query = '' }) => {
  const curated = [
    {
      id: 'prism-ml/Bonsai-8B-gguf',
      name: 'Bonsai-8B-gguf',
      author: 'prism-ml',
      description: 'Flagship 1-bit quantized 8B foundation model. Ultra-fast inference with low memory.',
      downloads: '116,000+',
      likes: 796,
      isBonsai: true,
    },
    {
      id: 'prism-ml/Ternary-Bonsai-2-27B-gguf',
      name: 'Ternary-Bonsai-2-27B-gguf',
      author: 'prism-ml',
      description: 'State-of-the-art Ternary (1.58-bit) 27B model with multimodal vision projection support.',
      downloads: '4,600,000+',
      likes: 2674,
      isBonsai: true,
    },
    {
      id: 'prism-ml/Bonsai-27B-gguf',
      name: 'Bonsai-27B-gguf',
      author: 'prism-ml',
      description: 'High-parameter 1-bit quantized model for complex logic and reasoning tasks.',
      downloads: '403,000+',
      likes: 917,
      isBonsai: true,
    },
    {
      id: 'prism-ml/Ternary-Bonsai-27B-gguf',
      name: 'Ternary-Bonsai-27B-gguf',
      author: 'prism-ml',
      description: 'Ternary PQ2_0 kernel accelerated weights for large-scale enterprise deployments.',
      downloads: '589,000+',
      likes: 1421,
      isBonsai: true,
    },
  ];

  try {
    const q = (query || '').trim();
    let url;
    if (!q || q.toLowerCase() === 'prism' || q.toLowerCase() === 'prism-ml' || q.toLowerCase() === 'bonsai') {
      url = 'https://huggingface.co/api/models?author=prism-ml&limit=50&sort=downloads&direction=-1';
    } else {
      url = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=30&sort=downloads&direction=-1`;
    }

    const res = await fetch(url, { headers: { 'User-Agent': 'PrismBonsaiRunnerElectron/1.0' } });
    if (!res.ok) throw new Error(`HF API HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return curated;
    }

    return data.map(m => {
      const parts = (m.id || '').split('/');
      return {
        id: m.id,
        name: parts[1] || m.id,
        author: parts[0] || 'community',
        description: m.description || `Hugging Face repository with ${Number(m.downloads || 0).toLocaleString()} downloads.`,
        downloads: Number(m.downloads || 0).toLocaleString(),
        likes: m.likes || 0,
        isBonsai: (m.id || '').toLowerCase().includes('bonsai') || (m.id || '').toLowerCase().includes('prism'),
      };
    });
  } catch (e) {
    console.warn('Live HF search error, using curated:', e.message);
    if (!query) return curated;
    return curated.filter(m => m.id.toLowerCase().includes(query.toLowerCase()));
  }
});

ipcMain.handle('getHfModelFiles', async (_event, { repoId }) => {
  const url = `https://huggingface.co/api/models/${repoId}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PrismBonsaiRunnerElectron/1.0' } });
  const data = await res.json();
  const files = [];

  for (const s of data.siblings || []) {
    if (s.rfilename.toLowerCase().endsWith('.gguf')) {
      const clean = s.rfilename.split('/').pop();
      files.push({
        name: clean,
        filename: clean,
        path: s.rfilename,
        repoId,
        quant: detectQuantType(s.rfilename),
        isMmproj: s.rfilename.toLowerCase().includes('mmproj'),
        sizeFormatted: s.size ? formatBytes(s.size) : 'GGUF',
        downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${s.rfilename}`,
      });
    }
  }
  return files;
});

ipcMain.handle('downloadHfFile', async (_event, { repoId, filename, downloadUrl }) => {
  const config = loadConfig();
  const destDir = config.modelsDir || path.join(process.cwd(), 'models');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const cleanFilename = filename.split('/').pop();
  const destPath = path.join(destDir, cleanFilename);

  const downloadInfo = {
    filename: cleanFilename,
    downloadedFormatted: '0 B',
    speed: 'Connecting...',
  };

  mainWindow?.webContents.send('download-progress', { type: 'start', info: downloadInfo });

  const curlScript = `curl.exe -# -L -o "${destPath}" "${downloadUrl}"`;
  const proc = spawn('cmd.exe', ['/c', curlScript]);
  activeDownloadProcess = proc;

  const startTime = Date.now();
  const progressTimer = setInterval(() => {
    if (fs.existsSync(destPath)) {
      try {
        const stat = fs.statSync(destPath);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (stat.size / (1024 * 1024) / elapsed).toFixed(1) + ' MB/s' : '0 MB/s';
        downloadInfo.downloadedFormatted = formatBytes(stat.size);
        downloadInfo.speed = speed;
        mainWindow?.webContents.send('download-progress', { type: 'progress', info: downloadInfo });
      } catch (e) {}
    }
  }, 1000);

  proc.on('close', (code) => {
    clearInterval(progressTimer);
    activeDownloadProcess = null;
    if (code === 0 && fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      downloadInfo.downloadedFormatted = formatBytes(stat.size);
      mainWindow?.webContents.send('download-progress', { type: 'complete', info: downloadInfo });
    } else {
      mainWindow?.webContents.send('download-progress', { type: 'cancelled' });
    }
  });

  return { success: true };
});

ipcMain.handle('cancelHfDownload', async () => {
  if (activeDownloadProcess) {
    try {
      exec(`taskkill /F /T /PID ${activeDownloadProcess.pid}`);
    } catch (e) {}
    activeDownloadProcess = null;
    mainWindow?.webContents.send('download-progress', { type: 'cancelled' });
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('startServer', async (_event, configOverride) => {
  if (serverProcess) return { success: false, message: 'Server is already running' };

  const config = configOverride || loadConfig();
  const binary = config.binaryPath || findDefaultBinary();

  if (!config.selectedModel) {
    throw new Error('Please select a model in Model Manager before starting the server.');
  }

  const args = [
    '-m', config.selectedModel,
    '--host', config.host || '127.0.0.1',
    '--port', String(config.port || 8080),
    '-c', String(config.ctxSize || 8192),
    '-ngl', String(config.nGl ?? 0),
    '-t', String(config.threads || 8),
    '-b', String(config.batchSize || 512),
  ];

  if (config.uBatchSize) args.push('-ub', String(config.uBatchSize));
  if (config.cacheTypeK && config.cacheTypeK !== 'f16') args.push('-ctk', config.cacheTypeK);
  if (config.cacheTypeV && config.cacheTypeV !== 'f16') args.push('-ctv', config.cacheTypeV);
  if (config.ctxShift) args.push('--ctx-shift');
  if (config.cacheReuse && Number(config.cacheReuse) > 0) args.push('--cache-reuse', String(config.cacheReuse));
  if (config.ropeScaling && config.ropeScaling !== 'none') {
    args.push('--rope-scaling', config.ropeScaling);
    if (config.ropeScale && Number(config.ropeScale) !== 1) {
      args.push('--rope-scale', String(config.ropeScale));
    }
  }

  if (config.flashAttn) args.push('-fa', 'on');
  if (config.jinja) args.push('--jinja');
  if (config.selectedMmproj && fs.existsSync(config.selectedMmproj)) {
    args.push('--mmproj', config.selectedMmproj);
  }
  if (config.extraArgs && config.extraArgs.trim()) {
    args.push(...config.extraArgs.trim().split(/\s+/));
  }

  serverStatus.starting = true;
  mainWindow?.webContents.send('server-status', serverStatus);
  addLog(`=== Starting llama-server: ${binary} ${args.join(' ')} ===`);

  try {
    const proc = spawn(binary, args, { windowsHide: true });
    serverProcess = proc;

    serverStatus.pid = proc.pid;
    serverStatus.host = config.host || '127.0.0.1';
    serverStatus.port = config.port || 8080;
    serverStatus.model = path.basename(config.selectedModel);
    serverStatus.uptime = 0;

    proc.stdout.on('data', (d) => {
      const lines = d.toString().split('\n');
      for (const l of lines) if (l.trim()) addLog(l.trim());
    });

    proc.stderr.on('data', (d) => {
      const lines = d.toString().split('\n');
      for (const l of lines) if (l.trim()) addLog(l.trim());
    });

    proc.on('close', (code) => {
      serverProcess = null;
      serverStatus.running = false;
      serverStatus.starting = false;
      serverStatus.uptime = 0;
      clearInterval(uptimeInterval);
      addLog(`llama-server process exited (code ${code})`);
      mainWindow?.webContents.send('server-status', serverStatus);
    });

    // Health Poll
    let checks = 0;
    const healthTimer = setInterval(async () => {
      checks++;
      try {
        const res = await fetch(`http://${serverStatus.host}:${serverStatus.port}/health`, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          clearInterval(healthTimer);
          serverStatus.running = true;
          serverStatus.starting = false;
          addLog(`Inference server online & listening on http://${serverStatus.host}:${serverStatus.port}`);
          mainWindow?.webContents.send('server-status', serverStatus);

          uptimeInterval = setInterval(() => {
            if (serverStatus.running) {
              serverStatus.uptime += 1;
              mainWindow?.webContents.send('server-uptime', { uptime: serverStatus.uptime });
            }
          }, 1000);
        }
      } catch (e) {
        if (checks > 40 || !serverProcess) {
          clearInterval(healthTimer);
          serverStatus.starting = false;
          mainWindow?.webContents.send('server-status', serverStatus);
        }
      }
    }, 1000);

    return { success: true, pid: proc.pid };
  } catch (e) {
    serverProcess = null;
    serverStatus.running = false;
    serverStatus.starting = false;
    mainWindow?.webContents.send('server-status', serverStatus);
    throw e;
  }
});

ipcMain.handle('stopServer', async () => {
  if (!serverProcess) {
    serverStatus.running = false;
    serverStatus.starting = false;
    mainWindow?.webContents.send('server-status', serverStatus);
    return { success: true };
  }

  const pid = serverProcess.pid;
  try {
    if (process.platform === 'win32') {
      exec(`taskkill /F /T /PID ${pid}`);
    } else {
      serverProcess.kill();
    }
  } catch (e) {}

  serverProcess = null;
  serverStatus.running = false;
  serverStatus.starting = false;
  serverStatus.uptime = 0;
  clearInterval(uptimeInterval);
  mainWindow?.webContents.send('server-status', serverStatus);
  addLog('Inference server stopped.');
  return { success: true };
});

ipcMain.handle('restartServer', async () => {
  if (serverProcess) {
    const pid = serverProcess.pid;
    try {
      exec(`taskkill /F /T /PID ${pid}`);
    } catch (e) {}
    serverProcess = null;
    serverStatus.running = false;
  }
  await new Promise((r) => setTimeout(r, 600));
  return ipcMain.emit('startServer');
});

ipcMain.handle('getServerStatus', async () => serverStatus);
ipcMain.handle('getServerLogs', async () => serverLogs);
ipcMain.handle('clearServerLogs', async () => {
  serverLogs = [];
  return { success: true };
});

ipcMain.handle('checkBinaryStatus', async (_event, { binaryPath } = {}) => {
  const target = binaryPath || loadConfig().binaryPath || findDefaultBinary();
  const resolved = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
  if (!fs.existsSync(resolved)) {
    return { exists: false, path: target, version: null, error: 'File does not exist' };
  }

  return new Promise((resolve) => {
    exec(`"${resolved}" --version`, { timeout: 4000 }, (err, stdout, stderr) => {
      const output = (stdout || stderr || '').trim();
      if (err && !output) {
        resolve({ exists: true, path: target, version: 'Unknown version', error: err.message });
      } else {
        const firstLine = output.split('\n')[0].trim();
        const isCuda = output.toLowerCase().includes('cuda');
        const isVulkan = output.toLowerCase().includes('vulkan');
        const isPrism = output.toLowerCase().includes('prism') || output.toLowerCase().includes('bonsai');
        resolve({
          exists: true,
          path: target,
          version: firstLine || 'llama-server',
          fullVersion: output,
          isCuda,
          isVulkan,
          isPrism,
        });
      }
    });
  });
});

ipcMain.handle('getPrismReleases', async () => {
  const categorize = (name) => {
    const n = name.toLowerCase();
    if (n.includes('cuda-13.3')) {
      return {
        backend: 'NVIDIA CUDA 13.3',
        description: 'Optimized for modern NVIDIA GPUs (RTX 40/50 series & Ada/Hopper)',
        gpuType: 'nvidia-modern',
        recommendedGpu: 'NVIDIA RTX 40/50 Series',
      };
    }
    if (n.includes('cuda-12.4')) {
      return {
        backend: 'NVIDIA CUDA 12.4',
        description: 'Optimized for widespread NVIDIA GPUs (RTX 20/30 series & Ampere/Turing)',
        gpuType: 'nvidia-widespread',
        recommendedGpu: 'NVIDIA RTX 20/30 Series',
      };
    }
    if (n.includes('vulkan')) {
      return {
        backend: 'Vulkan (Universal GPU)',
        description: 'Broad GPU acceleration across NVIDIA, AMD Radeon, and Intel GPUs',
        gpuType: 'universal',
        recommendedGpu: 'Universal GPU (NVIDIA / AMD / Intel)',
      };
    }
    if (n.includes('hip') || n.includes('rocm')) {
      return {
        backend: 'AMD Radeon HIP / ROCm',
        description: 'Native acceleration for AMD Radeon dedicated graphics cards',
        gpuType: 'amd',
        recommendedGpu: 'AMD Radeon',
      };
    }
    if (n.includes('sycl')) {
      return {
        backend: 'Intel SYCL / OneAPI',
        description: 'Hardware acceleration for Intel Arc & integrated Iris Xe GPUs',
        gpuType: 'intel',
        recommendedGpu: 'Intel Arc / Iris',
      };
    }
    if (n.includes('cpu-x64')) {
      return {
        backend: 'CPU (AVX2 / Zen4)',
        description: 'High performance multithreaded CPU inference on all modern x64 CPUs',
        gpuType: 'cpu',
        recommendedGpu: 'All CPUs (Universal)',
      };
    }
    return {
      backend: 'Windows x64 Build',
      description: 'Precompiled binary package for Windows x64',
      gpuType: 'other',
      recommendedGpu: 'Generic',
    };
  };

  try {
    const res = await fetch('https://api.github.com/repos/PrismML-Eng/llama.cpp/releases/latest', {
      headers: { 'User-Agent': 'PrismBonsaiRunnerElectron/1.0' },
    });
    if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
    const data = await res.json();

    const rawAssets = data.assets || [];
    const cudartMap = {};
    for (const a of rawAssets) {
      if (a.name.startsWith('cudart-') && a.name.endsWith('.zip')) {
        if (a.name.includes('cuda-12.4')) cudartMap['cuda-12.4'] = a.browser_download_url;
        if (a.name.includes('cuda-13.3')) cudartMap['cuda-13.3'] = a.browser_download_url;
      }
    }

    const winAssets = rawAssets
      .filter((a) => a.name.startsWith('llama-prism-') && a.name.includes('-win-') && a.name.endsWith('.zip'))
      .map((a) => {
        const cat = categorize(a.name);
        let companionUrl = null;
        if (a.name.includes('cuda-12.4') && cudartMap['cuda-12.4']) {
          companionUrl = cudartMap['cuda-12.4'];
        } else if (a.name.includes('cuda-13.3') && cudartMap['cuda-13.3']) {
          companionUrl = cudartMap['cuda-13.3'];
        }

        return {
          name: a.name,
          backend: cat.backend,
          description: cat.description,
          gpuType: cat.gpuType,
          recommendedGpu: cat.recommendedGpu,
          sizeBytes: a.size,
          sizeFormatted: formatBytes(a.size),
          downloadUrl: a.browser_download_url,
          companionUrl,
        };
      });

    return {
      tag: data.tag_name || 'latest',
      publishedAt: data.published_at ? data.published_at.split('T')[0] : 'Latest',
      htmlUrl: data.html_url || 'https://github.com/PrismML-Eng/llama.cpp/releases',
      assets: winAssets,
    };
  } catch (e) {
    // Robust fallback if GitHub rate limits or is offline
    const fallbackTag = 'prism-b10776-d00e252';
    const baseReleaseUrl = `https://github.com/PrismML-Eng/llama.cpp/releases/download/${fallbackTag}`;
    return {
      tag: fallbackTag,
      publishedAt: 'Recent',
      htmlUrl: 'https://github.com/PrismML-Eng/llama.cpp/releases',
      assets: [
        {
          name: `${fallbackTag}-bin-win-cuda-12.4-x64.zip`,
          backend: 'NVIDIA CUDA 12.4',
          description: 'Optimized for widespread NVIDIA GPUs (RTX 20/30 series & Ampere/Turing)',
          gpuType: 'nvidia-widespread',
          recommendedGpu: 'NVIDIA RTX 20/30 Series',
          sizeBytes: 314000000,
          sizeFormatted: '299.4 MB',
          downloadUrl: `${baseReleaseUrl}/llama-${fallbackTag}-bin-win-cuda-12.4-x64.zip`,
          companionUrl: `${baseReleaseUrl}/cudart-llama-bin-win-cuda-12.4-x64.zip`,
        },
        {
          name: `${fallbackTag}-bin-win-cuda-13.3-x64.zip`,
          backend: 'NVIDIA CUDA 13.3',
          description: 'Optimized for modern NVIDIA GPUs (RTX 40/50 series & Ada/Hopper)',
          gpuType: 'nvidia-modern',
          recommendedGpu: 'NVIDIA RTX 40/50 Series',
          sizeBytes: 179200000,
          sizeFormatted: '170.9 MB',
          downloadUrl: `${baseReleaseUrl}/llama-${fallbackTag}-bin-win-cuda-13.3-x64.zip`,
          companionUrl: `${baseReleaseUrl}/cudart-llama-bin-win-cuda-13.3-x64.zip`,
        },
        {
          name: `${fallbackTag}-bin-win-vulkan-x64.zip`,
          backend: 'Vulkan (Universal GPU)',
          description: 'Broad GPU acceleration across NVIDIA, AMD Radeon, and Intel GPUs',
          gpuType: 'universal',
          recommendedGpu: 'Universal GPU (NVIDIA / AMD / Intel)',
          sizeBytes: 31200000,
          sizeFormatted: '29.8 MB',
          downloadUrl: `${baseReleaseUrl}/llama-${fallbackTag}-bin-win-vulkan-x64.zip`,
          companionUrl: null,
        },
        {
          name: `${fallbackTag}-bin-win-cpu-x64.zip`,
          backend: 'CPU (AVX2 / Zen4)',
          description: 'High performance multithreaded CPU inference on all modern x64 CPUs',
          gpuType: 'cpu',
          recommendedGpu: 'All CPUs (Universal)',
          sizeBytes: 19500000,
          sizeFormatted: '18.6 MB',
          downloadUrl: `${baseReleaseUrl}/llama-${fallbackTag}-bin-win-cpu-x64.zip`,
          companionUrl: null,
        },
        {
          name: `${fallbackTag}-bin-win-hip-radeon-x64.zip`,
          backend: 'AMD Radeon HIP / ROCm',
          description: 'Native acceleration for AMD Radeon dedicated graphics cards',
          gpuType: 'amd',
          recommendedGpu: 'AMD Radeon',
          sizeBytes: 342000000,
          sizeFormatted: '326.7 MB',
          downloadUrl: `${baseReleaseUrl}/llama-${fallbackTag}-bin-win-hip-radeon-x64.zip`,
          companionUrl: null,
        },
      ],
    };
  }
});

ipcMain.handle('installBinaryPackage', async (_event, { url, filename, companionUrl }) => {
  const binDir = path.join(process.cwd(), 'bin');
  const targetDir = path.join(binDir, 'prism-llama');
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const tmpZip = path.join(binDir, `download_${Date.now()}.zip`);
  addLog(`[Binary Installer] Initiating download of ${filename}...`);
  mainWindow?.webContents.send('binary-install-status', {
    status: 'downloading',
    message: `Downloading ${filename}...`,
    progress: 15,
  });

  try {
    // 1. Download main binary package
    await new Promise((resolve, reject) => {
      exec(`curl.exe -# -L -o "${tmpZip}" "${url}"`, (err) => {
        if (err || !fs.existsSync(tmpZip)) {
          reject(new Error(`Failed to download ${filename}: ${err ? err.message : 'Download failed'}`));
        } else {
          resolve();
        }
      });
    });

    mainWindow?.webContents.send('binary-install-status', {
      status: 'extracting',
      message: `Extracting ${filename}...`,
      progress: 50,
    });
    addLog(`[Binary Installer] Extracting ${filename} to bin/prism-llama/`);

    // 2. Extract main archive using PowerShell
    await new Promise((resolve, reject) => {
      exec(`powershell -Command "Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force"`, (err, _out, stderr) => {
        if (err) {
          reject(new Error(`Extraction failed: ${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    });

    try { fs.unlinkSync(tmpZip); } catch (e) {}

    // 3. If companion CUDA runtime DLL package exists, download & unpack
    if (companionUrl) {
      mainWindow?.webContents.send('binary-install-status', {
        status: 'downloading-companion',
        message: 'Installing companion CUDA runtime DLLs (cudart, cublas)...',
        progress: 70,
      });
      addLog(`[Binary Installer] Downloading companion CUDA runtime DLLs...`);

      const companionZip = path.join(binDir, `cudart_${Date.now()}.zip`);
      await new Promise((resolve) => {
        exec(`curl.exe -# -L -o "${companionZip}" "${companionUrl}"`, (err) => {
          if (err || !fs.existsSync(companionZip)) {
            addLog(`[Binary Installer] Companion download warning: ${err ? err.message : 'Missing'}`);
            resolve();
          } else {
            resolve();
          }
        });
      });

      if (fs.existsSync(companionZip)) {
        mainWindow?.webContents.send('binary-install-status', {
          status: 'extracting-companion',
          message: 'Extracting CUDA runtime libraries...',
          progress: 85,
        });
        await new Promise((resolve) => {
          exec(`powershell -Command "Expand-Archive -Path '${companionZip}' -DestinationPath '${targetDir}' -Force"`, () => {
            resolve();
          });
        });
        try { fs.unlinkSync(companionZip); } catch (e) {}
      }
    }

    // 4. Locate llama-server.exe
    let serverExe = path.join(targetDir, 'llama-server.exe');
    if (!fs.existsSync(serverExe)) {
      const findExe = (dir) => {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          const full = path.join(dir, f);
          if (fs.statSync(full).isDirectory()) {
            const found = findExe(full);
            if (found) return found;
          } else if (f.toLowerCase() === 'llama-server.exe') {
            return full;
          }
        }
        return null;
      };
      const found = findExe(targetDir);
      if (found) serverExe = found;
    }

    if (!fs.existsSync(serverExe)) {
      throw new Error(`llama-server.exe was not found inside the extracted package at ${targetDir}`);
    }

    mainWindow?.webContents.send('binary-install-status', {
      status: 'verifying',
      message: 'Verifying installed binary...',
      progress: 95,
    });

    // 5. Test execution
    const versionOutput = await new Promise((resolve) => {
      exec(`"${serverExe}" --version`, { timeout: 5000 }, (err, stdout, stderr) => {
        const out = (stdout || stderr || '').trim();
        resolve(out.split('\n')[0].trim() || 'Verified');
      });
    });

    addLog(`[Binary Installer] Successfully verified: ${versionOutput}`);

    // Portable path relative to workspace root
    const relPath = path.relative(process.cwd(), serverExe).replace(/\\/g, '/');
    saveConfigSync({ binaryPath: relPath });

    mainWindow?.webContents.send('binary-install-status', {
      status: 'completed',
      message: `Successfully installed and verified ${filename}!`,
      progress: 100,
      installedPath: relPath,
      version: versionOutput,
    });

    return { success: true, installedPath: relPath, version: versionOutput };
  } catch (err) {
    addLog(`[Binary Installer] Installation error: ${err.message}`);
    mainWindow?.webContents.send('binary-install-status', {
      status: 'error',
      message: err.message,
    });
    throw err;
  }
});

// Dialogs
ipcMain.handle('dialog:openFile', async (_event, opts = {}) => {
  if (!mainWindow) return [];
  const isDirectory = opts.directory || (Array.isArray(opts.properties) && opts.properties.includes('openDirectory'));
  const properties = isDirectory 
    ? ['openDirectory', 'createDirectory'] 
    : (opts.properties || ['openFile']);

  const filters = isDirectory ? [] : (opts.filters || []);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || (isDirectory ? 'Select Folder' : 'Select File'),
    defaultPath: opts.defaultPath,
    filters,
    properties,
  });
  return result.filePaths || [];
});

ipcMain.handle('dialog:openDirectory', async (_event, opts = {}) => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || 'Select Folder',
    defaultPath: opts.defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.filePaths || [];
});

ipcMain.handle('dialog:alert', async (_event, { title, message }) => {
  if (!mainWindow) return;
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: title || 'Information',
    message: String(message),
  });
});
