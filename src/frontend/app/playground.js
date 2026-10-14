// Chat Playground Module with Streaming Inference & DaisyUI Chat Bubbles
import { $, esc, appState } from './state.js';
import { createChatBubble } from './components.js';

export function setupPlaygroundListeners() {
  $('btnSendChat').addEventListener('click', sendChatMessage);
  $('btnStopChat').addEventListener('click', stopChatMessage);
  
  $('chatInputText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  $('btnClearChat').addEventListener('click', clearChat);
  
  $('btnToggleChatDrawer').addEventListener('click', () => {
    $('chatSettingsSidebar').classList.toggle('hidden');
  });

  $('chatTempSlider').addEventListener('input', (e) => {
    $('chatTempVal').textContent = e.target.value;
  });

  $('chatTopPSlider').addEventListener('input', (e) => {
    $('chatTopPVal').textContent = e.target.value;
  });
}

export async function sendChatMessage() {
  const input = $('chatInputText');
  const message = input.value.trim();
  if (!message || appState.isGenerating) return;

  if (!appState.serverStatus.running) {
    tiny.dialog.alert('Server Not Running', 'Please start the inference server first before sending messages.');
    return;
  }

  // Append user bubble (DaisyUI chat-end)
  appendChatBubble('user', message);
  appState.chatHistory.push({ role: 'user', content: message });
  input.value = '';

  // Setup assistant bubble (DaisyUI chat-start)
  const assistantBubble = appendChatBubble('assistant', '...');
  const bubbleContent = assistantBubble.querySelector('.bubble-content');
  bubbleContent.textContent = '';

  appState.isGenerating = true;
  $('btnSendChat').classList.add('hidden');
  $('btnStopChat').classList.remove('hidden');

  const host = appState.serverStatus.host || '127.0.0.1';
  const port = appState.serverStatus.port || 8080;
  const endpoint = `http://${host}:${port}/v1/chat/completions`;

  const systemPrompt = $('chatSystemPrompt').value.trim();
  const temperature = parseFloat($('chatTempSlider').value);
  const topP = parseFloat($('chatTopPSlider').value);
  const maxTokens = parseInt($('chatMaxTokens').value, 10) || 1024;
  const stream = $('chatStreamCheck').checked;

  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    ...appState.chatHistory
  ];

  const startTime = Date.now();
  let firstTokenTime = null;
  let tokenCount = 0;

  appState.chatAbortController = new AbortController();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messagesPayload,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream,
      }),
      signal: appState.chatAbortController.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Inference server responded with ${res.status}: ${errText}`);
    }

    if (stream) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += dec.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (!firstTokenTime) {
                  firstTokenTime = Date.now();
                  $('metricTtft').textContent = `${firstTokenTime - startTime}ms`;
                }
                tokenCount++;
                accumulated += delta;
                bubbleContent.textContent = accumulated;
                scrollChatToBottom();

                const elapsedSec = (Date.now() - firstTokenTime) / 1000;
                if (elapsedSec > 0.1) {
                  const tps = (tokenCount / elapsedSec).toFixed(1);
                  $('metricTps').textContent = `${tps} t/s`;
                }
                $('metricTokens').textContent = String(tokenCount);
              }
            } catch (err) {}
          }
        }
      }

      appState.chatHistory.push({ role: 'assistant', content: accumulated });
    } else {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      bubbleContent.textContent = reply;
      appState.chatHistory.push({ role: 'assistant', content: reply });
      if (data.usage) {
        $('metricTokens').textContent = String(data.usage.completion_tokens || 0);
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      bubbleContent.textContent += ' [Stopped by user]';
    } else {
      bubbleContent.textContent = `[Inference Error: ${e.message}]`;
    }
  } finally {
    appState.isGenerating = false;
    $('btnSendChat').classList.remove('hidden');
    $('btnStopChat').classList.add('hidden');
    appState.chatAbortController = null;
  }
}

export function stopChatMessage() {
  if (appState.chatAbortController) {
    appState.chatAbortController.abort();
  }
}

export function appendChatBubble(role, content) {
  const container = $('chatMessagesContainer');
  const chatRow = createChatBubble(role, content);
  container.appendChild(chatRow);
  scrollChatToBottom();
  return chatRow;
}

export function clearChat() {
  appState.chatHistory = [];
  $('chatMessagesContainer').innerHTML = `
    <div class="chat chat-start">
      <div class="chat-header text-xs opacity-70 mb-1 flex items-center gap-1.5">
        <span class="font-bold">Bonsai AI</span>
        <time class="text-xs opacity-50">Reset</time>
      </div>
      <div class="chat-bubble chat-bubble-neutral text-sm leading-relaxed shadow-sm">
        <span class="bubble-content">Conversation cleared. Ready for your questions!</span>
      </div>
    </div>
  `;
  $('metricTps').textContent = '0.0 t/s';
  $('metricTtft').textContent = '—';
  $('metricTokens').textContent = '0';
}

export function scrollChatToBottom() {
  const container = $('chatMessagesContainer');
  container.scrollTop = container.scrollHeight;
}
