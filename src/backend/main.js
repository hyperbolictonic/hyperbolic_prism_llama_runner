// Prism Bonsai Runner & Model Manager - Backend
// Running on txiki.js (QuickJS-ng + libuv)

const dec = new TextDecoder();
const enc = new TextEncoder();

const CONFIG_FILE = 'runner-config.json';
const DEFAULT_CONFIG = {
  binaryPath: 'bin/prism-llama/llama-server.exe',
  modelsDir: 'models',
  host: '127.0.0.1',
  port: 8080,
  ctxSize: 8192,
  nThreads: 8,
  nGpuLayers: 0,
  batchSize: 512,
  flashAttn: true,
  jinja: true,
  customArgs: '',
  selectedModel: '',
  selectedMmproj: '',
  systemPrompt: 'You are Bonsai, an ultra-fast, intelligent, low-bit AI assistant trained by PrismML.',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 1024,
};

let serverProcess = null;
let serverStatus = {
  running: false,
  starting: false,
  pid: null,
  host: '127.0.0.1',
  port: 8080,
  model: '',
  startTime: null,
  uptime: 0,
  lastError: null,
};

let serverLogs = [];
const MAX_LOG_LINES = 1000;

let activeDownloadProcess = null;
let activeDownloadInfo = null;

function addLog(text, level = 'info') {
  const line = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString(),
    level,
    text: String(text).replace(/\r/g, ''),
  };
  serverLogs.push(line);
  if (serverLogs.length > MAX_LOG_LINES) {
    serverLogs.shift();
  }
  return line;
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
  if (f.includes('MMPROJ')) return 'Vision Projector';
  if (f.includes('PTQ1_0')) return 'Ternary (PTQ1_0)';
  if (f.includes('PQ2_0') || f.includes('TERNARY-2')) return 'Ternary (PQ2_0)';
  if (f.includes('Q1_0') || f.includes('1BIT') || f.includes('1-BIT') || f.includes('BITNET')) return '1-bit (Q1_0)';
  if (f.includes('IQ1_S') || f.includes('IQ1_M')) return '1-bit (IQ1)';
  if (f.includes('IQ2_XXS') || f.includes('IQ2_XS') || f.includes('IQ2_S') || f.includes('IQ2_M') || f.includes('Q2_K') || f.includes('Q2_0')) return '2-bit (Q2)';
  if (f.includes('IQ3_XXS') || f.includes('IQ3_S') || f.includes('IQ3_M') || f.includes('Q3_K') || f.includes('Q3_0')) return '3-bit (Q3)';
  if (f.includes('Q4_K_M')) return '4-bit (Q4_K_M)';
  if (f.includes('Q4_K_S')) return '4-bit (Q4_K_S)';
  if (f.includes('Q4_0')) return '4-bit (Q4_0)';
  if (f.includes('Q4_1')) return '4-bit (Q4_1)';
  if (f.includes('IQ4_NL') || f.includes('IQ4_XS')) return '4-bit (IQ4)';
  if (f.includes('Q4_K')) return '4-bit (Q4_K)';
  if (f.includes('Q5_K_M')) return '5-bit (Q5_K_M)';
  if (f.includes('Q5_K_S')) return '5-bit (Q5_K_S)';
  if (f.includes('Q5_0') || f.includes('Q5_1') || f.includes('Q5_K')) return '5-bit (Q5)';
  if (f.includes('Q6_K')) return '6-bit (Q6_K)';
  if (f.includes('Q8_0') || f.includes('Q8_K')) return '8-bit (Q8_0)';
  if (f.includes('BF16')) return '16-bit (BF16)';
  if (f.includes('F16') || f.includes('FP16')) return '16-bit (FP16)';
  if (f.includes('F32') || f.includes('FP32')) return '32-bit (FP32)';
  return 'GGUF Model';
}

async function fileExists(path) {
  try {
    const s = await tjs.stat(path);
    return !!s;
  } catch (e) {
    return false;
  }
}

async function loadConfig() {
  try {
    if (await fileExists(CONFIG_FILE)) {
      const data = await tjs.readFile(CONFIG_FILE);
      const json = JSON.parse(dec.decode(data));
      return { ...DEFAULT_CONFIG, ...json };
    }
  } catch (e) {
    console.error('Failed to read config file:', e);
  }
  return { ...DEFAULT_CONFIG };
}

async function saveConfig(cfg) {
  try {
    const current = await loadConfig();
    const merged = { ...current, ...cfg };
    const text = JSON.stringify(merged, null, 2);
    await tjs.writeFile(CONFIG_FILE, enc.encode(text));
    return merged;
  } catch (e) {
    console.error('Failed to save config:', e);
    throw e;
  }
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatHfRepo(m) {
  const parts = (m.id || '').split('/');
  const author = parts[0] || '';
  const repoName = parts[1] || m.id;
  const isBonsai = (m.id || '').toLowerCase().includes('bonsai') || (m.id || '').toLowerCase().includes('prism');
  return {
    id: m.id,
    name: repoName,
    author: author,
    description: m.description || `Hugging Face repository with ${Number(m.downloads || 0).toLocaleString()} downloads.`,
    downloads: Number(m.downloads || 0).toLocaleString(),
    likes: m.likes || 0,
    isBonsai,
  };
}

export const api = {
  async getSystemInfo() {
    let gpus = [];
    try {
      const proc = tjs.spawn(['powershell', '-Command', "Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM | ConvertTo-Json -Compress"], {
        stdout: 'pipe',
        stderr: 'ignore'
      });
      const reader = proc.stdout.getReader();
      let raw = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value);
      }
      await proc.wait();
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        gpus = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (e) {}

    let cudaInfo = null;
    try {
      const proc = tjs.spawn(['nvidia-smi', '--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'], {
        stdout: 'pipe',
        stderr: 'ignore'
      });
      const reader = proc.stdout.getReader();
      let raw = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value);
      }
      await proc.wait();
      if (raw.trim()) {
        const parts = raw.trim().split(',').map(s => s.trim());
        cudaInfo = {
          name: parts[0],
          vramMB: parseInt(parts[1], 10),
          driver: parts[2]
        };
      }
    } catch (e) {}

    return {
      runtime: 'txiki.js ' + tjs.version,
      platform: 'Windows (WebView2)',
      cpus: tjs.system.cpus.length,
      cpuModel: tjs.system.cpus[0]?.model || 'Unknown CPU',
      gpus,
      cudaInfo,
      cwd: tjs.cwd,
    };
  },

  async getConfig() {
    return await loadConfig();
  },

  async saveConfig(cfg) {
    return await saveConfig(cfg);
  },

  async detectBinaries() {
    const candidates = [
      'bin/prism-llama/llama-server.exe',
      'bin/llama-server.exe',
      'llama-server.exe'
    ];
    const results = [];
    for (const c of candidates) {
      if (await fileExists(c)) {
        let versionText = 'Found';
        try {
          const proc = tjs.spawn([c, '--version'], { stdout: 'pipe', stderr: 'ignore' });
          const reader = proc.stdout.getReader();
          let out = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            out += dec.decode(value);
          }
          await proc.wait();
          versionText = out.trim() || 'PrismML llama-server';
        } catch (e) {}
        results.push({ path: c, exists: true, version: versionText });
      }
    }
    return results;
  },

  async getPrismReleases() {
    try {
      const res = await fetch('https://api.github.com/repos/PrismML-Eng/llama.cpp/releases?per_page=5', {
        headers: { 'User-Agent': 'PrismBonsaiRunner' }
      });
      if (!res.ok) throw new Error('GitHub API responded with ' + res.status);
      const releases = await res.json();
      const assets = [];
      for (const rel of releases) {
        for (const asset of rel.assets || []) {
          if (asset.name.includes('win-') && asset.name.endsWith('.zip')) {
            let backend = 'CPU (Standard)';
            if (asset.name.includes('cuda-13')) backend = 'NVIDIA CUDA 13.3 (GPU)';
            else if (asset.name.includes('cuda-12')) backend = 'NVIDIA CUDA 12.4 (GPU)';
            else if (asset.name.includes('vulkan')) backend = 'Vulkan (AMD / Intel / NVIDIA GPU)';
            else if (asset.name.includes('hip')) backend = 'AMD Radeon HIP (ROCm GPU)';
            assets.push({
              tag: rel.tag_name,
              name: asset.name,
              backend,
              sizeBytes: asset.size,
              sizeFormatted: formatBytes(asset.size),
              downloadUrl: asset.browser_download_url
            });
          }
        }
      }
      return assets;
    } catch (e) {
      return [
        {
          tag: 'prism-b10772-e8fd209',
          name: 'llama-prism-b10772-e8fd209-bin-win-cpu-x64.zip',
          backend: 'CPU (Standard AVX2/Zen4)',
          sizeBytes: 19458591,
          sizeFormatted: '18.56 MB',
          downloadUrl: 'https://github.com/PrismML-Eng/llama.cpp/releases/download/prism-b10772-e8fd209/llama-prism-b10772-e8fd209-bin-win-cpu-x64.zip'
        },
        {
          tag: 'prism-b10772-e8fd209',
          name: 'llama-prism-b10772-e8fd209-bin-win-cuda-13.3-x64.zip',
          backend: 'NVIDIA CUDA 13.3 (GPU)',
          sizeBytes: 179142811,
          sizeFormatted: '170.84 MB',
          downloadUrl: 'https://github.com/PrismML-Eng/llama.cpp/releases/download/prism-b10772-e8fd209/llama-prism-b10772-e8fd209-bin-win-cuda-13.3-x64.zip'
        },
        {
          tag: 'prism-b10772-e8fd209',
          name: 'llama-prism-b10772-e8fd209-bin-win-vulkan-x64.zip',
          backend: 'Vulkan (Universal GPU)',
          sizeBytes: 31242630,
          sizeFormatted: '29.79 MB',
          downloadUrl: 'https://github.com/PrismML-Eng/llama.cpp/releases/download/prism-b10772-e8fd209/llama-prism-b10772-e8fd209-bin-win-vulkan-x64.zip'
        }
      ];
    }
  },

  async installBinaryPackage({ url, filename }, app) {
    try {
      app.push('binary-install-status', { status: 'downloading', message: 'Downloading ' + filename + '...' });
      const tmpZip = 'bin\\download_' + Date.now() + '.zip';
      const destDir = 'bin\\prism-llama';

      const script = `
        try {
          curl.exe -L -o "${tmpZip}" "${url}"
          if (-not (Test-Path "${tmpZip}")) { throw "Download failed" }
          New-Item -ItemType Directory -Force "${destDir}" | Out-Null
          Expand-Archive -Path "${tmpZip}" -DestinationPath "${destDir}" -Force
          Remove-Item -Force "${tmpZip}"
          Write-Output "SUCCESS"
        } catch {
          Write-Error $_
          exit 1
        }
      `;

      const proc = tjs.spawn(['powershell', '-Command', script], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const reader = proc.stdout.getReader();
      let output = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        output += dec.decode(value);
      }
      const exitCode = await proc.wait();
      if (exitCode.exit_status !== 0) {
        throw new Error('Install command failed with code ' + exitCode.exit_status);
      }

      await saveConfig({ binaryPath: 'bin/prism-llama/llama-server.exe' });
      app.push('binary-install-status', { status: 'completed', message: 'Binary installed successfully!' });
      return { success: true, binaryPath: 'bin/prism-llama/llama-server.exe' };
    } catch (e) {
      app.push('binary-install-status', { status: 'error', message: 'Installation failed: ' + e.message });
      throw e;
    }
  },

  async listLocalModels() {
    const config = await loadConfig();
    const dir = config.modelsDir || 'models';
    if (!(await fileExists(dir))) {
      await tjs.makeDir(dir);
    }

    const models = [];
    try {
      const iter = await tjs.readDir(dir);
      for await (const entry of iter) {
        if (!entry.isDirectory && entry.name.toLowerCase().endsWith('.gguf')) {
          const fullPath = dir.replace(/\\/g, '/').replace(/\/$/, '') + '/' + entry.name;
          const stat = await tjs.stat(fullPath);
          const isMmproj = entry.name.toLowerCase().includes('mmproj');
          models.push({
            name: entry.name,
            path: fullPath,
            sizeBytes: stat.size,
            sizeFormatted: formatBytes(stat.size),
            modified: new Date(stat.mtime).toLocaleString(),
            quant: detectQuantType(entry.name),
            isMmproj,
          });
        }
      }
    } catch (e) {
      console.error('Error listing models:', e);
    }
    models.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return models;
  },

  async deleteModel({ path }) {
    try {
      await tjs.remove(path);
      return { success: true };
    } catch (e) {
      throw new Error('Could not delete model: ' + e.message);
    }
  },

  async searchHuggingFace({ query = '' }) {
    const curated = [
      {
        id: 'prism-ml/Bonsai-8B-gguf',
        name: 'PrismML Bonsai 8B',
        author: 'prism-ml',
        description: 'Flagship 1-bit quantized 8B model. Extreme inference speed with minimal memory footprint.',
        downloads: '116k+',
        likes: 796,
        isBonsai: true,
      },
      {
        id: 'prism-ml/Ternary-Bonsai-2-27B-gguf',
        name: 'PrismML Ternary Bonsai 2 27B',
        author: 'prism-ml',
        description: 'State-of-the-art Ternary (1.58-bit) 27B model with multimodal projector and native tool use.',
        downloads: '4.6M+',
        likes: 2674,
        isBonsai: true,
      },
      {
        id: 'prism-ml/Bonsai-27B-gguf',
        name: 'PrismML Bonsai 27B',
        author: 'prism-ml',
        description: 'High-parameter 1-bit quantized Bonsai foundation model for demanding reasoning tasks.',
        downloads: '403k+',
        likes: 917,
        isBonsai: true,
      },
      {
        id: 'prism-ml/Ternary-Bonsai-27B-gguf',
        name: 'PrismML Ternary Bonsai 27B',
        author: 'prism-ml',
        description: 'Ternary quantization with PQ2_0 kernel acceleration for efficient large-scale inference.',
        downloads: '589k+',
        likes: 1421,
        isBonsai: true,
      },
    ];

    try {
      const q = (query || '').trim();
      let url;
      if (!q || q.toLowerCase() === 'prism' || q.toLowerCase() === 'prism-ml' || q.toLowerCase() === 'bonsai') {
        // Query live models directly published under the official prism-ml organization
        url = 'https://huggingface.co/api/models?author=prism-ml&limit=50&sort=downloads&direction=-1';
      } else {
        url = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=30&sort=downloads&direction=-1`;
      }

      const res = await fetch(url, { headers: { 'User-Agent': 'PrismBonsaiRunner' } });
      if (!res.ok) throw new Error(`HF API responded with ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        if (url.includes('author=')) {
          const fallbackRes = await fetch('https://huggingface.co/api/models?search=prism-ml&limit=30', { headers: { 'User-Agent': 'PrismBonsaiRunner' } });
          const fallbackData = await fallbackRes.json();
          if (Array.isArray(fallbackData) && fallbackData.length > 0) {
            return fallbackData.map(m => formatHfRepo(m));
          }
        }
        return curated;
      }

      return data.map(m => formatHfRepo(m));
    } catch (e) {
      console.warn('Live Hugging Face search failed, using fallback:', e.message);
      if (!query || query.toLowerCase() === 'prism-ml' || query.toLowerCase() === 'bonsai') return curated;
      return curated.filter(m => m.id.toLowerCase().includes(query.toLowerCase()));
    }
  },

  async getHfModelFiles({ repoId }) {
    try {
      const config = await loadConfig();
      const token = (config.hfToken || '').trim() || (typeof process !== 'undefined' && process.env && (process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN)) || '';
      const files = [];
      const headers = { 'User-Agent': 'PrismBonsaiRunner' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 1. Fetch siblings with blob sizes
      let data = null;
      try {
        const url = `https://huggingface.co/api/models/${repoId}?blobs=true`;
        const res = await fetch(url, { headers });
        if (res.ok) data = await res.json();
      } catch (e) {}

      if (data && Array.isArray(data.siblings) && data.siblings.length > 0) {
        for (const s of data.siblings) {
          const lower = (s.rfilename || '').toLowerCase();
          if (lower.endsWith('.gguf') || lower.endsWith('.mmproj')) {
            const cleanName = s.rfilename.split('/').pop();
            const sizeBytes = (s.lfs && typeof s.lfs.size === 'number' && s.lfs.size > 0)
              ? s.lfs.size
              : (typeof s.size === 'number' ? s.size : 0);

            files.push({
              name: cleanName,
              filename: cleanName,
              path: s.rfilename,
              repoId,
              quant: detectQuantType(cleanName),
              isMmproj: lower.includes('mmproj'),
              sizeBytes,
              sizeFormatted: sizeBytes > 0 ? formatBytes(sizeBytes) : 'Unknown size',
              downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${s.rfilename}`,
            });
          }
        }
      }

      // 2. Fallback to tree API if needed
      if (files.length === 0 || files.some(f => f.sizeBytes === 0)) {
        try {
          const treeRes = await fetch(`https://huggingface.co/api/models/${repoId}/tree/main?recursive=true`, { headers });
          if (treeRes.ok) {
            const treeData = await treeRes.json();
            if (Array.isArray(treeData)) {
              const sizeMap = new Map();
              for (const item of treeData) {
                if (item.type === 'file' && item.path) {
                  const sBytes = (item.lfs && typeof item.lfs.size === 'number' && item.lfs.size > 0)
                    ? item.lfs.size
                    : (typeof item.size === 'number' ? item.size : 0);
                  sizeMap.set(item.path, sBytes);
                }
              }

              if (files.length === 0) {
                for (const [filePath, sBytes] of sizeMap.entries()) {
                  const lower = filePath.toLowerCase();
                  if (lower.endsWith('.gguf') || lower.endsWith('.mmproj')) {
                    const cleanName = filePath.split('/').pop();
                    files.push({
                      name: cleanName,
                      filename: cleanName,
                      path: filePath,
                      repoId,
                      quant: detectQuantType(cleanName),
                      isMmproj: lower.includes('mmproj'),
                      sizeBytes: sBytes,
                      sizeFormatted: sBytes > 0 ? formatBytes(sBytes) : 'Unknown size',
                      downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${filePath}`,
                    });
                  }
                }
              } else {
                for (const f of files) {
                  if (f.sizeBytes === 0 && sizeMap.has(f.path)) {
                    f.sizeBytes = sizeMap.get(f.path);
                    if (f.sizeBytes > 0) f.sizeFormatted = formatBytes(f.sizeBytes);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }

      files.sort((a, b) => {
        if (a.isMmproj !== b.isMmproj) return a.isMmproj ? 1 : -1;
        return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      });

      return files;
    } catch (e) {
      throw new Error('Failed to fetch files for repository ' + repoId + ': ' + e.message);
    }
  },

  async downloadHfFile({ repoId, filename, downloadUrl }, app) {
    if (activeDownloadProcess) {
      throw new Error('Another download is already in progress');
    }

    const config = await loadConfig();
    const destDir = config.modelsDir || 'models';
    if (!(await fileExists(destDir))) {
      await tjs.makeDir(destDir);
    }
    const cleanFilename = filename.split('/').pop();
    const destPath = `${destDir}/${cleanFilename}`.replace(/\\/g, '/');

    activeDownloadInfo = {
      filename: cleanFilename,
      destPath,
      repoId,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: '0 MB/s',
      startTime: Date.now()
    };

    app.push('model-download-update', {
      type: 'start',
      info: activeDownloadInfo
    });

    const token = (config.hfToken || '').trim() || (typeof process !== 'undefined' && process.env && (process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN)) || '';
    const authHeader = token ? `-H "Authorization: Bearer ${token}" ` : '';

    const script = `
      $url = "${downloadUrl}"
      $dest = "${destPath.replace(/\//g, '\\')}"
      curl.exe -# -L -C - -A "Mozilla/5.0" --connect-timeout 30 --keepalive-time 15 --speed-limit 1024 --speed-time 25 --retry 8 --retry-delay 2 --retry-all-errors ${authHeader}-o "$dest" "$url"
    `;

    try {
      const proc = tjs.spawn(['powershell', '-Command', script], {
        stdout: 'pipe',
        stderr: 'pipe'
      });
      activeDownloadProcess = proc;

      // Watch file size growth to report progress
      const progressTimer = setInterval(async () => {
        try {
          if (await fileExists(destPath)) {
            const stat = await tjs.stat(destPath);
            const elapsed = (Date.now() - activeDownloadInfo.startTime) / 1000;
            const speed = elapsed > 0 ? (stat.size / (1024 * 1024) / elapsed).toFixed(2) + ' MB/s' : '0 MB/s';
            activeDownloadInfo.downloadedBytes = stat.size;
            activeDownloadInfo.downloadedFormatted = formatBytes(stat.size);
            activeDownloadInfo.speed = speed;
            app.push('model-download-update', {
              type: 'progress',
              info: activeDownloadInfo
            });
          }
        } catch (e) {}
      }, 1000);

      const status = await proc.wait();
      clearInterval(progressTimer);
      activeDownloadProcess = null;

      if (status.exit_status === 0) {
        const stat = await tjs.stat(destPath);
        activeDownloadInfo.downloadedBytes = stat.size;
        activeDownloadInfo.progress = 100;
        app.push('model-download-update', {
          type: 'complete',
          info: activeDownloadInfo
        });
        return { success: true, path: destPath };
      } else {
        throw new Error('Download failed or was aborted');
      }
    } catch (e) {
      activeDownloadProcess = null;
      app.push('model-download-update', {
        type: 'error',
        error: e.message
      });
      throw e;
    }
  },

  async cancelHfDownload(params, app) {
    if (activeDownloadProcess) {
      try {
        const pid = activeDownloadProcess.pid;
        tjs.spawn(['taskkill', '/F', '/T', '/PID', String(pid)]);
        activeDownloadProcess = null;
        app.push('model-download-update', { type: 'cancelled' });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'No active download' };
  },

  async startServer(params, app) {
    if (serverProcess) {
      return { success: false, error: 'Server is already running' };
    }

    const config = await loadConfig();
    const binary = config.binaryPath || 'bin/prism-llama/llama-server.exe';
    if (!(await fileExists(binary))) {
      throw new Error(`Prism llama-server executable not found at: ${binary}. Please install or select a valid binary in Settings.`);
    }

    if (!config.selectedModel) {
      throw new Error('No model selected. Please select a model in Model Manager or Runner config.');
    }
    if (!(await fileExists(config.selectedModel))) {
      throw new Error(`Selected model file does not exist: ${config.selectedModel}`);
    }

    serverStatus.starting = true;
    serverStatus.lastError = null;
    app.push('server-status', serverStatus);
    addLog(`=== Starting Prism llama-server (pid pending) ===`, 'info');

    const args = [
      '-m', config.selectedModel,
      '--host', config.host || '127.0.0.1',
      '--port', String(config.port || 8080),
      '-c', String(config.ctxSize || 8192),
      '-ngl', String(config.nGpuLayers || 0),
      '-t', String(config.nThreads || 8),
      '-b', String(config.batchSize || 512),
    ];

    if (config.flashAttn) {
      args.push('-fa', 'on');
    }
    if (config.jinja) {
      args.push('--jinja');
    }
    if (config.selectedMmproj && (await fileExists(config.selectedMmproj))) {
      args.push('--mmproj', config.selectedMmproj);
    }
    if (config.customArgs && config.customArgs.trim()) {
      const extra = config.customArgs.trim().split(/\s+/);
      args.push(...extra);
    }

    addLog(`Command: ${binary} ${args.join(' ')}`, 'info');

    try {
      const proc = tjs.spawn([binary, ...args], {
        stdout: 'pipe',
        stderr: 'pipe'
      });
      serverProcess = proc;
      serverStatus.pid = proc.pid;
      serverStatus.host = config.host || '127.0.0.1';
      serverStatus.port = config.port || 8080;
      serverStatus.model = config.selectedModel.split('/').pop().split('\\').pop();
      serverStatus.startTime = Date.now();

      // Read stdout
      (async () => {
        try {
          const reader = proc.stdout.getReader();
          let buf = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value);
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const l of lines) {
              if (l.trim()) {
                const log = addLog(l, 'info');
                app.push('server-log', log);
              }
            }
          }
        } catch (e) {}
      })();

      // Read stderr
      (async () => {
        try {
          const reader = proc.stderr.getReader();
          let buf = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value);
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const l of lines) {
              if (l.trim()) {
                const level = l.includes('ERR') || l.includes('error') ? 'error' : (l.includes('WARN') ? 'warn' : 'info');
                const log = addLog(l, level);
                app.push('server-log', log);
              }
            }
          }
        } catch (e) {}
      })();

      // Monitor health check
      let checks = 0;
      const healthTimer = setInterval(async () => {
        checks++;
        try {
          const res = await fetch(`http://${serverStatus.host}:${serverStatus.port}/health`, { signal: AbortSignal.timeout(1000) });
          if (res.ok) {
            clearInterval(healthTimer);
            serverStatus.running = true;
            serverStatus.starting = false;
            addLog(`Prism llama-server is READY on http://${serverStatus.host}:${serverStatus.port}`, 'info');
            app.push('server-status', serverStatus);
          }
        } catch (e) {
          if (checks > 60 || !serverProcess) {
            clearInterval(healthTimer);
            if (!serverStatus.running) {
              serverStatus.starting = false;
              serverStatus.lastError = 'Health check timed out after 60 seconds';
              app.push('server-status', serverStatus);
            }
          }
        }
      }, 1000);

      // Handle process exit
      (async () => {
        const exitResult = await proc.wait();
        clearInterval(healthTimer);
        serverProcess = null;
        serverStatus.running = false;
        serverStatus.starting = false;
        serverStatus.uptime = 0;
        addLog(`Prism llama-server exited (code: ${exitResult.exit_status}, signal: ${exitResult.term_signal})`, exitResult.exit_status === 0 ? 'info' : 'error');
        app.push('server-status', serverStatus);
      })();

      return { success: true, pid: proc.pid };
    } catch (e) {
      serverProcess = null;
      serverStatus.starting = false;
      serverStatus.running = false;
      serverStatus.lastError = e.message;
      addLog(`Failed to spawn server: ${e.message}`, 'error');
      app.push('server-status', serverStatus);
      throw e;
    }
  },

  async stopServer(params, app) {
    if (!serverProcess) {
      serverStatus.running = false;
      serverStatus.starting = false;
      app.push('server-status', serverStatus);
      return { success: true };
    }

    addLog('Stopping Prism llama-server...', 'info');
    const pid = serverProcess.pid;
    try {
      serverProcess.kill();
    } catch (e) {}

    // Force tree kill via taskkill on Windows to ensure no orphaned server instances
    try {
      tjs.spawn(['taskkill', '/F', '/T', '/PID', String(pid)]);
    } catch (e) {}

    serverProcess = null;
    serverStatus.running = false;
    serverStatus.starting = false;
    serverStatus.uptime = 0;
    app.push('server-status', serverStatus);
    addLog('Prism llama-server stopped.', 'info');
    return { success: true };
  },

  async restartServer(params, app) {
    if (serverProcess) {
      await api.stopServer(params, app);
    }
    return await api.startServer(params, app);
  },

  async getServerStatus() {
    if (serverStatus.running && serverStatus.startTime) {
      serverStatus.uptime = Math.floor((Date.now() - serverStatus.startTime) / 1000);
    }
    return serverStatus;
  },

  async getServerLogs() {
    return serverLogs;
  },

  async clearServerLogs() {
    serverLogs = [];
    return { success: true };
  },

  async openInExplorer({ path }) {
    try {
      const isDir = (await tjs.stat(path))?.isDirectory;
      const target = path.replace(/\//g, '\\');
      if (isDir) {
        tjs.spawn(['explorer.exe', target]);
      } else {
        tjs.spawn(['explorer.exe', '/select,', target]);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

export function init(app) {
  // Push periodic status update (uptime & health)
  setInterval(() => {
    if (serverStatus.running && serverStatus.startTime) {
      serverStatus.uptime = Math.floor((Date.now() - serverStatus.startTime) / 1000);
      app.push('server-heartbeat', {
        uptime: serverStatus.uptime,
        running: true,
        pid: serverStatus.pid
      });
    }
  }, 1000);
}
