// Reusable DaisyUI Component Builders
import { esc } from './state.js';

/**
 * Creates an authentic DaisyUI Chat Bubble row
 */
export function createChatBubble(role, content, timeString = null) {
  const isUser = role === 'user';
  const time = timeString || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const chatRow = document.createElement('div');
  chatRow.className = `chat ${isUser ? 'chat-end' : 'chat-start'}`;
  chatRow.innerHTML = `
    <div class="chat-header text-xs opacity-70 mb-1 flex items-center gap-1.5">
      <span class="font-bold">${isUser ? 'You' : 'Bonsai AI'}</span>
      <time class="text-xs opacity-50">${esc(time)}</time>
    </div>
    <div class="chat-bubble ${isUser ? 'chat-bubble-primary' : 'chat-bubble-neutral'} text-sm leading-relaxed shadow-sm">
      <span class="bubble-content">${esc(content)}</span>
    </div>
  `;
  return chatRow;
}

/**
 * Creates a reusable DaisyUI Local Model Card
 */
export function createModelCard(m, isActive, isMmprojActive, handlers = {}) {
  let quantBadgeClass = 'badge-primary';
  if (m.quant && m.quant.includes('Ternary')) quantBadgeClass = 'badge-accent';
  if (m.isMmproj) quantBadgeClass = 'badge-secondary';

  const card = document.createElement('div');
  card.className = `card bg-base-200 border border-base-300 shadow-md hover:border-primary transition-all duration-200 ${isActive ? 'ring-2 ring-primary bg-primary/5' : ''}`;
  card.innerHTML = `
    <div class="card-body p-5 flex flex-col justify-between space-y-3">
      
      <!-- Card Header -->
      <div class="flex justify-between items-center">
        <span class="badge ${quantBadgeClass} badge-sm font-bold font-mono">${esc(m.quant)}</span>
        <span class="text-xs font-mono opacity-60">${esc(m.sizeFormatted)}</span>
      </div>

      <!-- Title & File Path -->
      <div class="space-y-1">
        <h4 class="font-bold text-white text-sm flex items-center gap-2 break-all">
          <svg viewBox="0 0 24 24" width="16" height="16" class="text-primary shrink-0" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <span>${esc(m.name)}</span>
        </h4>
        <p class="text-xs font-mono opacity-50 truncate" title="${esc(m.path)}">${esc(m.path)}</p>
      </div>

      <!-- Meta Info -->
      <div class="flex justify-between items-center text-xs opacity-70 pt-2 border-t border-base-300">
        <span>Modified: ${esc(m.modified)}</span>
        ${isActive ? '<span class="text-primary font-bold">★ ACTIVE</span>' : ''}
        ${isMmprojActive ? '<span class="text-secondary font-bold">★ VISION</span>' : ''}
      </div>

      <!-- Action Buttons -->
      <div class="card-actions justify-end pt-2 gap-2">
        ${!m.isMmproj ? `
          <button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm flex-1 font-bold btn-select-model">
            ${isActive ? '✓ Selected' : 'Select Model'}
          </button>
        ` : `
          <button class="btn ${isMmprojActive ? 'btn-primary' : 'btn-secondary'} btn-sm flex-1 font-bold btn-select-mmproj">
            ${isMmprojActive ? '✓ Vision Set' : 'Set Vision'}
          </button>
        `}
        <button class="btn btn-outline btn-sm btn-reveal-model" title="Open in Windows Explorer">📂</button>
        <button class="btn btn-error btn-outline btn-sm btn-delete-model" title="Delete Model">🗑️</button>
      </div>

    </div>
  `;

  if (handlers.onSelect) {
    const btn = card.querySelector('.btn-select-model');
    if (btn) btn.addEventListener('click', handlers.onSelect);
  }
  if (handlers.onSelectMmproj) {
    const btn = card.querySelector('.btn-select-mmproj');
    if (btn) btn.addEventListener('click', handlers.onSelectMmproj);
  }
  if (handlers.onReveal) {
    const btn = card.querySelector('.btn-reveal-model');
    if (btn) btn.addEventListener('click', handlers.onReveal);
  }
  if (handlers.onDelete) {
    const btn = card.querySelector('.btn-delete-model');
    if (btn) btn.addEventListener('click', handlers.onDelete);
  }

  return card;
}

/**
 * Creates a reusable DaisyUI Hugging Face Hub Card
 */
export function createHubCard(m, onInspect) {
  const card = document.createElement('div');
  card.className = `card bg-base-200 border border-base-300 shadow-md hover:border-primary transition-all duration-200 flex flex-col justify-between ${m.isBonsai ? 'ring-1 ring-primary/40' : ''}`;
  card.innerHTML = `
    <div class="card-body p-5 flex flex-col justify-between space-y-3">
      
      <!-- Card Header -->
      <div class="flex justify-between items-start gap-3">
        <span class="font-mono text-xs text-primary font-bold break-all flex-1">${esc(m.id)}</span>
        <div class="flex items-center gap-2 text-xs opacity-70 shrink-0">
          <span>❤️ ${esc(m.likes)}</span>
          <span>📥 ${esc(m.downloads)}</span>
        </div>
      </div>

      <!-- Title & Description -->
      <div class="space-y-1">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="16" height="16" class="text-primary shrink-0" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>${esc(m.name)}</span>
        </h4>
        <p class="text-xs text-base-content/70 line-clamp-2">${esc(m.description)}</p>
      </div>

      <!-- Card Actions -->
      <div class="card-actions justify-end pt-3 border-t border-base-300 gap-2">
        <button class="btn btn-primary btn-sm flex-1 font-bold btn-inspect-hub">
          Explore .GGUF Files
        </button>
        <a href="https://huggingface.co/${esc(m.id)}" target="_blank" class="btn btn-outline btn-sm">
          HF ↗
        </a>
      </div>

    </div>
  `;

  if (onInspect) {
    card.querySelector('.btn-inspect-hub').addEventListener('click', onInspect);
  }

  return card;
}
