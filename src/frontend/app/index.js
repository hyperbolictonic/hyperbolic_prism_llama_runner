// Application Aggregator & Orchestrator
import { $, appState, formatUptime } from './state.js';
import { setupRunnerListeners, renderSystemInfo, updateServerStatusUI } from './runner.js';
import { setupModelsListeners, refreshLocalModels, searchHub, handleDownloadUpdate } from './models.js';
import { setupPlaygroundListeners } from './playground.js';
import { setupLogsListeners, handleIncomingLog, renderLogs } from './logs.js';
import { setupSettingsListeners, applyConfigToUI, loadBinaryReleases } from './settings.js';

export async function initApp() {
  setupNavigation();
  setupRunnerListeners();
  setupModelsListeners();
  setupPlaygroundListeners();
  setupLogsListeners();
  setupSettingsListeners();
  setupBackendPushListeners();

  // Load system info
  try {
    const sys = await tiny.api.call('getSystemInfo');
    appState.systemInfo = sys;
    renderSystemInfo(sys);
  } catch (e) {
    console.error('Failed to load system info:', e);
  }

  // Load config
  try {
    const cfg = await tiny.api.call('getConfig');
    appState.config = cfg;
    applyConfigToUI(cfg);
  } catch (e) {
    console.error('Failed to load config:', e);
  }

  // Load server status
  try {
    const status = await tiny.api.call('getServerStatus');
    updateServerStatusUI(status);
  } catch (e) {}

  // Load server logs
  try {
    const logs = await tiny.api.call('getServerLogs');
    appState.logs = logs || [];
    renderLogs();
  } catch (e) {}

  // Load local models
  await refreshLocalModels();

  // Pre-load default curated hub models
  await searchHub('prism-ml');

  // Load releases
  await loadBinaryReleases();
}

function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('tab-active'));
      tab.classList.add('tab-active');

      const targetPaneId = 'pane-' + tab.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const targetPane = $(targetPaneId);
      if (targetPane) targetPane.classList.add('active');

      const label = tab.querySelector('span')?.textContent;
      if (label && $('breadcrumbActive')) {
        $('breadcrumbActive').textContent = label;
      }
    });
  });

  // Models Subnav (Local vs Hub)
  $('btnSubtabLocal').addEventListener('click', () => {
    $('btnSubtabLocal').classList.add('active', 'btn-secondary');
    $('btnSubtabLocal').classList.remove('btn-ghost');
    $('btnSubtabHub').classList.remove('active', 'btn-secondary');
    $('btnSubtabHub').classList.add('btn-ghost');
    $('viewLocalModels').classList.remove('hidden');
    $('viewHubModels').classList.add('hidden');
  });

  $('btnSubtabHub').addEventListener('click', () => {
    $('btnSubtabHub').classList.add('active', 'btn-secondary');
    $('btnSubtabHub').classList.remove('btn-ghost');
    $('btnSubtabLocal').classList.remove('active', 'btn-secondary');
    $('btnSubtabLocal').classList.add('btn-ghost');
    $('viewHubModels').classList.remove('hidden');
    $('viewLocalModels').classList.add('hidden');
  });

  $('btnGotoModels').addEventListener('click', () => {
    const modelTab = document.querySelector('.nav-tab[data-tab="models"]');
    if (modelTab) modelTab.click();
  });

  $('commandCenter').addEventListener('click', () => {
    const modelTab = document.querySelector('.nav-tab[data-tab="models"]');
    if (modelTab) modelTab.click();
  });
}

function setupBackendPushListeners() {
  tiny.api.on('server-log', (data) => {
    handleIncomingLog(data.line);
  });

  tiny.api.on('server-status', (data) => {
    updateServerStatusUI(data);
  });

  tiny.api.on('server-uptime', (data) => {
    $('dashUptimeVal').textContent = formatUptime(data.uptime);
  });

  tiny.api.on('download-progress', (event) => {
    handleDownloadUpdate(event);
  });
}
