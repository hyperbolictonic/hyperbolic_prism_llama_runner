// Live Logs Terminal Module
import { $, esc, appState } from './state.js';

export function setupLogsListeners() {
  $('inputSearchLogs').addEventListener('input', (e) => {
    appState.logSearchQuery = e.target.value.toLowerCase();
    renderLogs();
  });

  $('btnClearLogs').addEventListener('click', async () => {
    try {
      appState.logs = [];
      renderLogs();
    } catch (e) {}
  });

  $('btnCopyLogs').addEventListener('click', () => {
    const raw = appState.logs.join('\n');
    navigator.clipboard.writeText(raw);
    tiny.dialog.alert('Copied', `Copied ${appState.logs.length} lines of server logs to clipboard.`);
  });

  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active', 'btn-secondary'));
      btn.classList.add('active', 'btn-secondary');
      appState.logFilter = btn.dataset.filter;
      renderLogs();
    });
  });
}

export function handleIncomingLog(line) {
  appState.logs.push(line);
  if (appState.logs.length > 3000) appState.logs.shift();

  const term = $('logsTerminal');
  const autoScroll = $('checkAutoScroll').checked;

  const row = createLogLineElement(line);
  if (row) {
    term.appendChild(row);
    if (autoScroll) {
      term.scrollTop = term.scrollHeight;
    }
  }

  const liveDot = $('logLiveDot');
  if (liveDot) {
    liveDot.style.opacity = '1';
    setTimeout(() => {
      if (liveDot) liveDot.style.opacity = '0.5';
    }, 400);
  }
}

export function renderLogs() {
  const term = $('logsTerminal');
  term.innerHTML = '';

  const filter = appState.logFilter;
  const q = appState.logSearchQuery;

  const filtered = appState.logs.filter(line => {
    if (filter === 'error' && !/error|fatal|fail/i.test(line)) return false;
    if (filter === 'warn' && !/warn/i.test(line)) return false;
    if (filter === 'info' && /error|warn/i.test(line)) return false;
    if (q && !line.toLowerCase().includes(q)) return false;
    return true;
  });

  const fragment = document.createDocumentFragment();
  filtered.forEach(line => {
    const el = createLogLineElement(line);
    if (el) fragment.appendChild(el);
  });
  term.appendChild(fragment);

  if ($('checkAutoScroll').checked) {
    term.scrollTop = term.scrollHeight;
  }
}

function createLogLineElement(line) {
  const el = document.createElement('div');
  el.className = 'log-line py-0.5 leading-relaxed font-mono text-xs break-all';
  
  if (/error|fatal|fail/i.test(line)) {
    el.className += ' text-error font-semibold';
  } else if (/warn/i.test(line)) {
    el.className += ' text-warning';
  } else if (/slot|prompt eval|eval time|tokens per second|t\/s/i.test(line)) {
    el.className += ' text-primary';
  } else {
    el.className += ' text-base-content/70';
  }
  
  el.textContent = line;
  return el;
}
