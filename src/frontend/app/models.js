// Model Manager & Hugging Face Hub Module
import { $, esc, appState } from './state.js';
import { createModelCard, createHubCard } from './components.js';
import { updateActiveModelUI } from './runner.js';

export function setupModelsListeners() {
  $('inputFilterLocal').addEventListener('input', (e) => {
    renderLocalModelsGrid(e.target.value.trim());
  });

  $('btnOpenModelsDir').addEventListener('click', async () => {
    try {
      await tiny.api.call('openInExplorer', { path: appState.config.modelsDir || 'models' });
    } catch (e) {
      tiny.dialog.alert('Error', e.message);
    }
  });

  $('btnImportGguf').addEventListener('click', async () => {
    try {
      const selected = await tiny.dialog.openFile({
        title: 'Select GGUF Model File',
        filters: [{ name: 'GGUF Models', extensions: ['gguf', 'mmproj'] }],
      });
      if (selected && selected.length > 0) {
        const filePath = selected[0];
        appState.config.selectedModel = filePath;
        await tiny.api.call('saveConfig', { selectedModel: filePath });
        await refreshLocalModels();
        updateActiveModelUI();
        tiny.dialog.alert('Model Selected', `Active model set to:\n${filePath}`);
      }
    } catch (e) {
      console.log('File picker cancelled or unavailable:', e);
    }
  });

  $('btnExecuteHubSearch').addEventListener('click', () => {
    searchHub($('inputSearchHub').value);
  });

  $('inputSearchHub').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchHub($('inputSearchHub').value);
  });

  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('btn-primary', 'active');
      btn.classList.remove('btn-secondary');
      filterHubCards(btn.dataset.filter);
    });
  });

  $('btnCloseHubModal').addEventListener('click', () => {
    $('hubFileModal').close();
  });
  if ($('btnCloseHubModalBackdrop')) {
    $('btnCloseHubModalBackdrop').addEventListener('click', () => {
      $('hubFileModal').close();
    });
  }

  $('btnCancelDownload').addEventListener('click', async () => {
    try {
      await tiny.api.call('cancelHfDownload');
      $('downloadDrawer').classList.add('hidden');
    } catch (e) {}
  });
}

export async function refreshLocalModels() {
  try {
    const list = await tiny.api.call('listLocalModels');
    appState.localModels = list || [];
    renderLocalModelsGrid($('inputFilterLocal')?.value || '');
    updateActiveModelUI();
  } catch (e) {
    console.error('Failed to load local models:', e);
  }
}

export function renderLocalModelsGrid(filterText = '') {
  const grid = $('localModelsGrid');
  grid.innerHTML = '';

  let filtered = appState.localModels;
  if (filterText) {
    const q = filterText.toLowerCase();
    filtered = filtered.filter(m => m.name.toLowerCase().includes(q) || m.quant.toLowerCase().includes(q));
  }

  $('localModelsCount').textContent = appState.localModels.length;
  $('modelsCountBadge').textContent = appState.localModels.length;

  const totalBytes = appState.localModels.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);
  $('modelsTotalStorage').textContent = `Total Storage: ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-base-content/60 space-y-2">
        <p class="text-base font-bold text-white">No models found in your models directory.</p>
        <p class="text-xs">Switch to the <strong>Hugging Face Hub</strong> tab to download 1-bit or Ternary Bonsai models, or import an existing .gguf file.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(m => {
    const isActive = appState.config.selectedModel && appState.config.selectedModel.replace(/\\/g, '/').endsWith(m.name);
    const isMmprojActive = appState.config.selectedMmproj && appState.config.selectedMmproj.replace(/\\/g, '/').endsWith(m.name);

    const card = createModelCard(m, isActive, isMmprojActive, {
      onSelect: async () => {
        appState.config.selectedModel = m.path;
        await tiny.api.call('saveConfig', { selectedModel: m.path });
        updateActiveModelUI();
        renderLocalModelsGrid(filterText);
      },
      onSelectMmproj: async () => {
        appState.config.selectedMmproj = m.path;
        await tiny.api.call('saveConfig', { selectedMmproj: m.path });
        renderLocalModelsGrid(filterText);
      },
      onReveal: async () => {
        await tiny.api.call('openInExplorer', { path: m.path });
      },
      onDelete: async () => {
        if (confirm(`Are you sure you want to delete model ${m.name}? This cannot be undone.`)) {
          try {
            await tiny.api.call('deleteModel', { path: m.path });
            await refreshLocalModels();
          } catch (e) {
            tiny.dialog.alert('Error', e.message);
          }
        }
      }
    });

    grid.appendChild(card);
  });
}

export async function searchHub(query = 'prism-ml') {
  const grid = $('hubCardsGrid');
  grid.innerHTML = '<div class="col-span-full py-12 text-center text-base-content/60"><span class="loading loading-spinner loading-md text-primary mr-2"></span>Searching Hugging Face models...</div>';

  try {
    const models = await tiny.api.call('searchHuggingFace', { query });
    appState.hubModels = models || [];
    filterHubCards('prism');
  } catch (e) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-error font-bold">Search failed: ${esc(e.message)}</div>`;
  }
}

export function filterHubCards(filter) {
  let list = appState.hubModels;
  if (filter === 'prism') {
    list = list.filter(m => m.id.toLowerCase().startsWith('prism-ml'));
  } else if (filter === 'bonsai') {
    list = list.filter(m => m.name.toLowerCase().includes('bonsai'));
  } else if (filter === 'ternary') {
    list = list.filter(m => m.name.toLowerCase().includes('ternary') || m.description.toLowerCase().includes('ternary'));
  }
  renderHubCards(list);
}

export function renderHubCards(models) {
  const grid = $('hubCardsGrid');
  grid.innerHTML = '';

  if (models.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-base-content/60">No Hugging Face models match this filter.</div>';
    return;
  }

  models.forEach(m => {
    const card = createHubCard(m, () => openHubFileModal(m.id));
    grid.appendChild(card);
  });
}

export async function openHubFileModal(repoId) {
  if ($('hubModalTitleText')) {
    $('hubModalTitleText').textContent = `Repository: ${repoId}`;
  } else {
    $('hubModalTitle').textContent = `Repository: ${repoId}`;
  }
  $('hubModalSubtitle').textContent = 'Fetching files list from Hugging Face...';
  const list = $('hubModalFilesList');
  list.innerHTML = '<div class="flex justify-center py-8"><span class="loading loading-spinner loading-md text-primary"></span></div>';
  
  const modal = $('hubFileModal');
  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.classList.remove('hidden');
  }

  try {
    const files = await tiny.api.call('getHfModelFiles', { repoId });
    if (files.length === 0) {
      list.innerHTML = '<div class="text-base-content/60 p-4 text-center">No .gguf files discovered in this repository.</div>';
      return;
    }

    $('hubModalSubtitle').textContent = `Found ${files.length} GGUF / projector files. Click Download:`;
    list.innerHTML = '';

    files.forEach(f => {
      const isAlreadyDownloaded = appState.localModels.some(m => m.name === f.name);
      const item = document.createElement('div');
      item.className = 'bg-base-100 border border-base-300 p-3 rounded-lg flex justify-between items-center gap-3';
      item.innerHTML = `
        <div class="min-w-0 flex-1">
          <div class="font-mono text-xs font-bold text-white truncate">${esc(f.name)}</div>
          <div class="text-xs text-base-content/60 font-mono mt-0.5 flex items-center gap-2">
            <span>Size: <strong class="text-white">${esc(f.sizeFormatted || '—')}</strong></span>
            <span>·</span>
            <span>${esc(f.quant)} ${f.isMmproj ? '· Vision Projector' : ''}</span>
          </div>
        </div>
        <div class="shrink-0">
          ${isAlreadyDownloaded ? `
            <span class="text-xs font-bold text-primary mr-2">✓ Downloaded</span>
          ` : `
            <button class="btn btn-primary btn-sm font-bold btn-dl-file">
              Download
            </button>
          `}
        </div>
      `;

      const btnDl = item.querySelector('.btn-dl-file');
      if (btnDl) {
        btnDl.addEventListener('click', async () => {
          modal.close ? modal.close() : modal.classList.add('hidden');
          try {
            await tiny.api.call('downloadHfFile', {
              repoId,
              filename: f.name,
              downloadUrl: f.downloadUrl,
            });
          } catch (e) {
            tiny.dialog.alert('Download Error', e.message);
          }
        });
      }

      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = `<div class="text-error p-4 text-center font-bold">Failed to inspect repository: ${esc(e.message)}</div>`;
  }
}

export function handleDownloadUpdate(event) {
  const drawer = $('downloadDrawer');
  if (event.type === 'start') {
    drawer.classList.remove('hidden');
    $('drawerFilename').textContent = event.info.filename;
    $('drawerMeta').textContent = 'Starting download...';
    $('drawerProgressFill').value = 10;
  } else if (event.type === 'progress') {
    drawer.classList.remove('hidden');
    $('drawerFilename').textContent = event.info.filename;
    $('drawerMeta').textContent = `${event.info.downloadedFormatted} · ${event.info.speed}`;
    $('drawerProgressFill').value = 50;
  } else if (event.type === 'complete') {
    $('drawerMeta').textContent = `Complete (${event.info.downloadedFormatted})!`;
    $('drawerProgressFill').value = 100;
    setTimeout(() => {
      drawer.classList.add('hidden');
    }, 2500);
    refreshLocalModels();
    tiny.dialog.alert('Download Finished', `Model ${event.info.filename} is downloaded and ready!`);
  } else if (event.type === 'cancelled' || event.type === 'error') {
    drawer.classList.add('hidden');
  }
}
