// Settings & Binaries Module
import { $, esc, appState } from './state.js';

export function setupSettingsListeners() {
  $('btnBrowseBinary').addEventListener('click', async () => {
    try {
      const selected = await tiny.dialog.openFile({
        title: 'Select llama-server.exe Binary',
        filters: [{ name: 'Executables', extensions: ['exe'] }],
      });
      if (selected && selected.length > 0) {
        const binPath = selected[0];
        appState.config.binaryPath = binPath;
        await tiny.api.call('saveConfig', { binaryPath: binPath });
        $('settingsCurrentBinaryVal').textContent = binPath;
        tiny.dialog.alert('Binary Configured', `Active inference server binary set to:\n${binPath}`);
      }
    } catch (e) {
      console.log('Picker cancelled:', e);
    }
  });

  $('btnRefreshReleases').addEventListener('click', () => {
    loadBinaryReleases();
  });

  $('btnBrowseModelsDir').addEventListener('click', async () => {
    try {
      const selected = await tiny.dialog.openFile({
        title: 'Select Models Directory',
      });
      if (selected && selected.length > 0) {
        $('cfgModelsDir').value = selected[0];
      }
    } catch (e) {}
  });

  $('btnSaveConfig').addEventListener('click', async () => {
    const updated = {
      host: $('cfgHost').value.trim() || '127.0.0.1',
      port: parseInt($('cfgPort').value, 10) || 8080,
      ctxSize: parseInt($('cfgCtx').value, 10) || 8192,
      nGl: parseInt($('cfgGpu').value, 10) || 0,
      threads: parseInt($('cfgThreads').value, 10) || 8,
      batchSize: parseInt($('cfgBatch').value, 10) || 512,
      modelsDir: $('cfgModelsDir').value.trim() || 'models',
      extraArgs: $('cfgExtraArgs').value.trim(),
    };

    try {
      await tiny.api.call('saveConfig', updated);
      appState.config = { ...appState.config, ...updated };
      tiny.dialog.alert('Saved', 'Configuration parameters saved successfully.');
    } catch (e) {
      tiny.dialog.alert('Error', e.message);
    }
  });
}

export function applyConfigToUI(cfg) {
  if (cfg.host) $('cfgHost').value = cfg.host;
  if (cfg.port) $('cfgPort').value = cfg.port;
  if (cfg.ctxSize) {
    $('cfgCtx').value = cfg.ctxSize;
    $('dashSliderCtx').value = cfg.ctxSize;
    $('dashCtxDisplay').textContent = cfg.ctxSize;
  }
  if (cfg.nGl !== undefined) {
    $('cfgGpu').value = cfg.nGl;
    $('dashSliderGpu').value = cfg.nGl;
    $('dashGpuDisplay').textContent = cfg.nGl;
  }
  if (cfg.threads) {
    $('cfgThreads').value = cfg.threads;
    $('dashSliderThreads').value = cfg.threads;
    $('dashThreadsDisplay').textContent = cfg.threads;
  }
  if (cfg.batchSize) $('cfgBatch').value = cfg.batchSize;
  if (cfg.modelsDir) $('cfgModelsDir').value = cfg.modelsDir;
  if (cfg.extraArgs) $('cfgExtraArgs').value = cfg.extraArgs;
  if (cfg.flashAttn !== undefined) $('dashCheckFlashAttn').checked = cfg.flashAttn;
  if (cfg.jinja !== undefined) $('dashCheckJinja').checked = cfg.jinja;
  if (cfg.binaryPath) $('settingsCurrentBinaryVal').textContent = cfg.binaryPath;
}

export async function loadBinaryReleases() {
  const list = $('releaseAssetsList');
  list.innerHTML = '<div class="text-xs font-mono opacity-50"><span class="loading loading-spinner loading-xs text-primary mr-2"></span>Checking GitHub releases...</div>';

  try {
    const data = await tiny.api.call('getPrismReleases');
    if (!data || !data.assets || data.assets.length === 0) {
      list.innerHTML = '<div class="text-xs text-base-content/60">No official release assets discovered.</div>';
      return;
    }

    $('settingsBinaryVersionVal').textContent = `${data.tag} (${data.publishedAt || 'Latest'})`;
    list.innerHTML = '';

    data.assets.forEach(asset => {
      const item = document.createElement('div');
      item.className = 'bg-base-100 border border-base-300 p-3 rounded-lg flex justify-between items-center gap-3';
      item.innerHTML = `
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-white truncate font-mono">${esc(asset.name)}</div>
          <div class="text-xs font-mono text-base-content/60">${esc(asset.sizeFormatted)}</div>
        </div>
        <button class="btn btn-primary btn-sm font-bold shrink-0 btn-install-release">
          Install
        </button>
      `;

      item.querySelector('.btn-install-release').addEventListener('click', async () => {
        item.querySelector('.btn-install-release').innerHTML = '<span class="loading loading-spinner loading-xs"></span>';
        try {
          const res = await tiny.api.call('installBinaryPackage', {
            url: asset.downloadUrl,
            filename: asset.name,
          });
          tiny.dialog.alert('Installed', `Successfully installed ${asset.name}!\nRuntime path: ${res.installedPath}`);
          appState.config.binaryPath = res.installedPath;
          $('settingsCurrentBinaryVal').textContent = res.installedPath;
          await tiny.api.call('saveConfig', { binaryPath: res.installedPath });
        } catch (e) {
          tiny.dialog.alert('Install Failed', e.message);
        } finally {
          item.querySelector('.btn-install-release').textContent = 'Install';
        }
      });

      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = `<div class="text-xs text-error font-mono">Could not fetch releases: ${esc(e.message)}</div>`;
  }
}
