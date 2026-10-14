// Runner Dashboard & Inference Supervisor Module
import { $, esc, appState, formatUptime } from './state.js';

export function setupRunnerListeners() {
  $('btnToggleServer').addEventListener('click', toggleServer);
  $('btnRestartServer').addEventListener('click', restartServer);
  
  $('btnOpenBrowserApi').addEventListener('click', () => {
    const host = appState.serverStatus.host || '127.0.0.1';
    const port = appState.serverStatus.port || 8080;
    window.open(`http://${host}:${port}`, '_blank');
  });

  $('btnCopyApiEndpoint').addEventListener('click', () => {
    const host = appState.serverStatus.host || '127.0.0.1';
    const port = appState.serverStatus.port || 8080;
    const url = `http://${host}:${port}/v1`;
    navigator.clipboard.writeText(url);
    tiny.dialog.alert('Copied', `OpenAI-compatible API base URL copied to clipboard:\n${url}`);
  });

  $('btnTestHealth').addEventListener('click', testServerHealth);

  $('dashSliderCtx').addEventListener('input', (e) => {
    $('dashCtxDisplay').textContent = e.target.value;
    $('dashModelCtxVal').textContent = e.target.value;
    appState.config.ctxSize = parseInt(e.target.value, 10);
    saveLiveConfig();
  });

  $('dashSliderGpu').addEventListener('input', (e) => {
    $('dashGpuDisplay').textContent = e.target.value;
    $('dashModelGpuVal').textContent = e.target.value + ' layers';
    appState.config.nGl = parseInt(e.target.value, 10);
    saveLiveConfig();
  });

  $('dashSliderThreads').addEventListener('input', (e) => {
    $('dashThreadsDisplay').textContent = e.target.value;
    appState.config.threads = parseInt(e.target.value, 10);
    saveLiveConfig();
  });

  $('dashCheckFlashAttn').addEventListener('change', (e) => {
    appState.config.flashAttn = e.target.checked;
    saveLiveConfig();
  });

  $('dashCheckJinja').addEventListener('change', (e) => {
    appState.config.jinja = e.target.checked;
    saveLiveConfig();
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPreset(btn.dataset.preset);
    });
  });

  $('btnResetDefaults').addEventListener('click', () => {
    applyPreset('balanced');
  });
}

async function saveLiveConfig() {
  try {
    await tiny.api.call('saveConfig', appState.config);
  } catch (e) {}
}

export function applyPreset(preset) {
  if (preset === 'balanced') {
    $('dashSliderCtx').value = 8192;
    $('dashSliderGpu').value = 28;
    $('dashSliderThreads').value = Math.max(4, Math.floor((appState.systemInfo.cpuCores || 8) / 2));
    $('dashCheckFlashAttn').checked = true;
    $('dashCheckJinja').checked = true;
  } else if (preset === 'max-gpu') {
    $('dashSliderCtx').value = 4096;
    $('dashSliderGpu').value = 99;
    $('dashSliderThreads').value = 8;
    $('dashCheckFlashAttn').checked = true;
    $('dashCheckJinja').checked = true;
  } else if (preset === 'cpu') {
    $('dashSliderCtx').value = 8192;
    $('dashSliderGpu').value = 0;
    $('dashSliderThreads').value = appState.systemInfo.cpuCores || 8;
    $('dashCheckFlashAttn').checked = false;
    $('dashCheckJinja').checked = true;
  } else if (preset === 'long-ctx') {
    $('dashSliderCtx').value = 32768;
    $('dashSliderGpu').value = 16;
    $('dashSliderThreads').value = 8;
    $('dashCheckFlashAttn').checked = true;
    $('dashCheckJinja').checked = true;
  }

  $('dashSliderCtx').dispatchEvent(new Event('input'));
  $('dashSliderGpu').dispatchEvent(new Event('input'));
  $('dashSliderThreads').dispatchEvent(new Event('input'));
  $('dashCheckFlashAttn').dispatchEvent(new Event('change'));
  $('dashCheckJinja').dispatchEvent(new Event('change'));
}

export async function toggleServer() {
  if (appState.serverStatus.running) {
    await stopServer();
  } else {
    await startServer();
  }
}

export async function startServer() {
  if (!appState.config.selectedModel) {
    tiny.dialog.alert('No Model Selected', 'Please select a .gguf model in Model Manager before starting the inference server.');
    return;
  }

  try {
    $('serverStatusText').textContent = 'Starting...';
    $('serverStatusDot').className = 'status-dot starting';
    const res = await tiny.api.call('startServer', appState.config);
    updateServerStatusUI(res);
  } catch (e) {
    tiny.dialog.alert('Failed to Start Server', e.message);
    updateServerStatusUI({ running: false, starting: false });
  }
}

export async function stopServer() {
  try {
    $('serverStatusText').textContent = 'Stopping...';
    const res = await tiny.api.call('stopServer');
    updateServerStatusUI(res);
  } catch (e) {
    tiny.dialog.alert('Error', e.message);
  }
}

export async function restartServer() {
  await stopServer();
  setTimeout(() => startServer(), 600);
}

export async function testServerHealth() {
  const host = appState.serverStatus.host || '127.0.0.1';
  const port = appState.serverStatus.port || 8080;
  try {
    const res = await fetch(`http://${host}:${port}/health`);
    if (res.ok) {
      const data = await res.json();
      tiny.dialog.alert('Server Health: OK', `HTTP ${res.status}\nStatus: ${data.status || 'OK'}\nSlots idle: ${data.slots_idle ?? 'all'}`);
    } else {
      tiny.dialog.alert('Server Health Warning', `Server responded with HTTP ${res.status}`);
    }
  } catch (e) {
    tiny.dialog.alert('Server Unreachable', `Could not connect to http://${host}:${port}/health\n${e.message}`);
  }
}

export function updateServerStatusUI(status) {
  appState.serverStatus = { ...appState.serverStatus, ...status };

  const running = status.running;
  const starting = status.starting;

  $('serverStatusDot').className = `status-dot ${running ? 'running' : starting ? 'starting' : 'stopped'}`;
  $('serverStatusText').textContent = running ? 'Online' : starting ? 'Starting...' : 'Stopped';

  const btnToggle = $('btnToggleServer');
  if (running) {
    btnToggle.className = 'btn btn-error btn-sm gap-2 font-bold shadow-md';
    btnToggle.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <rect x="5" y="5" width="14" height="14" rx="2"/>
      </svg>
      <span>Stop Server</span>
    `;
  } else {
    btnToggle.className = 'btn btn-primary btn-sm gap-2 font-bold shadow-md';
    btnToggle.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <span>Start Server</span>
    `;
  }

  $('dashServerStateTag').textContent = running ? 'ONLINE' : starting ? 'STARTING...' : 'OFFLINE';
  $('dashServerStateTag').className = `badge font-mono font-bold ${running ? 'badge-primary' : 'badge-neutral'}`;

  $('dashEndpointVal').textContent = `http://${status.host || '127.0.0.1'}:${status.port || 8080}`;
  $('dashPidVal').textContent = status.pid ? String(status.pid) : '—';
  $('dashUptimeVal').textContent = formatUptime(status.uptime || 0);

  const circle = $('dashIndicatorCircle');
  const ring = $('dashPulseRing');
  if (running) {
    circle.className = 'server-indicator-circle w-16 h-16 rounded-full bg-primary/20 border-2 border-primary text-primary flex items-center justify-center shadow-lg';
    ring.className = 'pulse-ring active';
    $('dashServerHeadline').textContent = 'Server is running & ready';
    $('dashServerSubline').textContent = `Serving Bonsai model inferences at http://${status.host || '127.0.0.1'}:${status.port || 8080}`;
  } else {
    circle.className = 'server-indicator-circle w-16 h-16 rounded-full bg-base-100 border-2 border-base-300 flex items-center justify-center shadow-inner';
    ring.className = 'pulse-ring';
    $('dashServerHeadline').textContent = 'Server is offline';
    $('dashServerSubline').textContent = 'Select a model below or in Model Manager, then press Start Server to host low-bit inferences.';
  }

  $('chatServerDot').className = `status-dot ${running ? 'running' : 'stopped'}`;
  $('chatActiveModelName').textContent = running ? (appState.config.selectedModel?.split(/[/\\]/).pop() || 'Prism Bonsai') : 'No Server Running';
  $('footerServerPort').textContent = `Port: ${status.port || 8080} (${running ? 'Online' : 'Offline'})`;
}

export function updateActiveModelUI() {
  const modelPath = appState.config.selectedModel;
  if (!modelPath) {
    $('dashActiveModelTitle').textContent = 'No Model Selected';
    $('dashActiveModelPath').textContent = '—';
    $('dashModelQuantBadge').textContent = 'No Model';
    $('dashModelQuantBadge').className = 'badge badge-neutral badge-sm font-mono';
    $('headerActiveModelName').textContent = 'No model selected';
    return;
  }

  const filename = modelPath.replace(/\\/g, '/').split('/').pop();
  $('dashActiveModelTitle').textContent = filename;
  $('dashActiveModelPath').textContent = modelPath;
  $('headerActiveModelName').textContent = filename;

  let quant = 'GGUF';
  if (/Q1_0/i.test(filename)) quant = 'Bonsai 1-bit (Q1_0)';
  else if (/PQ2_0/i.test(filename)) quant = 'Ternary Bonsai (PQ2_0)';
  else if (/PTQ1_0/i.test(filename)) quant = 'Prism Ternary (PTQ1_0)';
  else if (/Q4_K/i.test(filename)) quant = 'Q4_K_M (4-bit)';
  else if (/Q8_0/i.test(filename)) quant = 'Q8_0 (8-bit)';

  $('dashModelQuantBadge').textContent = quant;
  $('dashModelQuantBadge').className = 'badge badge-primary badge-sm font-mono font-bold';
  $('dashModelQuantVal').textContent = quant;

  const found = appState.localModels.find(m => m.path === modelPath);
  if (found) {
    $('dashModelSizeVal').textContent = found.sizeFormatted;
  }
}

export function renderSystemInfo(sys) {
  if (sys.cpuModel) {
    $('dashCpuVal').textContent = `${sys.cpuModel} (${sys.cpuCores} cores)`;
  }
  if (sys.gpus && sys.gpus.length > 0) {
    const gpuNames = sys.gpus.map(g => g.name || g.caption).join(', ');
    $('dashGpuVal').textContent = gpuNames;
    $('dashGpuTag').textContent = 'CUDA ACCELERATED';
    $('dashGpuTag').className = 'badge badge-primary badge-sm font-mono font-bold';
    $('footerGpuName').textContent = gpuNames.split(',')[0];
  } else {
    $('dashGpuVal').textContent = 'No dedicated GPU detected (CPU mode)';
    $('dashGpuTag').textContent = 'CPU ONLY';
    $('dashGpuTag').className = 'badge badge-neutral badge-sm font-mono';
    $('footerGpuName').textContent = 'CPU Mode';
  }
}
