import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  MessageSquare, 
  Send, 
  Square, 
  Trash2, 
  Sliders, 
  Sparkles, 
  Zap, 
  Bot, 
  User, 
  Timer, 
  Gauge, 
  Hash,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function Playground() {
  const { serverStatus, config } = useApp();
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am ready to assist. You can adjust sampling parameters or start chatting directly below.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, concise AI assistant.');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Sampling parameters
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(true);

  // Metrics
  const [isGenerating, setIsGenerating] = useState(false);
  const [ttft, setTtft] = useState(null);
  const [tps, setTps] = useState(null);
  const [tokensCount, setTokensCount] = useState(0);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isGenerating) return;

    if (!serverStatus.running) {
      if (window.tiny && window.tiny.dialog) {
        window.tiny.dialog.alert('Server Not Running', 'Please start the inference server in the Supervisor or Navbar before sending messages.');
      } else {
        alert('Please start the inference server first.');
      }
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', content: text, timestamp: timeStr };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');

    // Prepare assistant placeholder
    const assistantMsg = { role: 'assistant', content: '', timestamp: timeStr };
    setMessages(prev => [...prev, assistantMsg]);

    setIsGenerating(true);
    setTtft(null);
    setTps(null);
    setTokensCount(0);

    const host = serverStatus.host || config.host || '127.0.0.1';
    const port = serverStatus.port || config.port || 8080;
    const endpoint = `http://${host}:${port}/v1/chat/completions`;

    const chatPayload = [
      { role: 'system', content: systemPrompt },
      ...nextMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    abortControllerRef.current = new AbortController();
    const startTime = Date.now();
    let firstTokenTime = null;
    let localTokens = 0;
    let accumulatedText = '';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatPayload,
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          stream,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Inference server responded with ${res.status}: ${errText}`);
      }

      if (stream) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  if (!firstTokenTime) {
                    firstTokenTime = Date.now();
                    setTtft(`${firstTokenTime - startTime}ms`);
                  }
                  localTokens++;
                  accumulatedText += delta;
                  setTokensCount(localTokens);

                  const elapsedSec = (Date.now() - firstTokenTime) / 1000;
                  if (elapsedSec > 0.1) {
                    setTps(`${(localTokens / elapsedSec).toFixed(1)} t/s`);
                  }

                  setMessages(prev => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content: accumulatedText,
                    };
                    return copy;
                  });
                }
              } catch (e) {}
            }
          }
        }
      } else {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: reply,
          };
          return copy;
        });
        if (data.usage) {
          setTokensCount(data.usage.completion_tokens || 0);
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: accumulatedText + ' [Stopped by user]',
          };
          return copy;
        });
      } else {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: `Error: ${e.message}`,
          };
          return copy;
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setTtft(null);
    setTps(null);
    setTokensCount(0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 bg-base-100 overflow-hidden">
      
      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        
        {/* Chat Playground Header with Metrics & Actions */}
        <div className="bg-base-200/80 border-b border-base-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-sm text-white">Chat Playground</h2>
            <div className="badge badge-primary badge-outline badge-xs font-mono ml-1">
              OpenAI /v1/chat
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-base-content/70" title="Time to first token">
              <Timer className="w-3.5 h-3.5 text-primary" />
              <span>TTFT: <strong className="text-white">{ttft || '—'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-base-content/70" title="Tokens per second">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              <span>Speed: <strong className="text-white">{tps || '—'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-base-content/70" title="Tokens generated">
              <Hash className="w-3.5 h-3.5 text-primary" />
              <span>Tokens: <strong className="text-white">{tokensCount}</strong></span>
            </div>
          </div>

          {/* Playground Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="btn btn-outline btn-neutral btn-xs gap-1"
            >
              <span>System Prompt</span>
              {showSystemPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={handleClearChat}
              className="btn btn-outline btn-neutral btn-xs gap-1 text-base-content/70 hover:text-error"
              title="Clear chat history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className={`btn btn-xs gap-1 ${showDrawer ? 'btn-primary text-black font-bold' : 'btn-outline btn-neutral'}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Parameters</span>
            </button>
          </div>

        </div>

        {/* Collapsible System Prompt Banner */}
        {showSystemPrompt && (
          <div className="bg-base-200/90 border-b border-base-300 p-4 shrink-0 transition-all">
            <label className="block text-2xs uppercase tracking-wider font-semibold text-base-content/60 mb-1">
              System Instruction
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={2}
              className="textarea textarea-bordered textarea-sm w-full font-mono text-xs bg-base-100"
              placeholder="Set the persona, directives, or constraints for the assistant..."
            />
          </div>
        )}

        {/* Messages Stream Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
              <Bot className="w-12 h-12 text-primary stroke-[1.5]" />
              <div className="text-sm font-semibold text-white">Inference Ready</div>
              <p className="text-xs max-w-sm text-base-content/70">
                Type a prompt below to start an inference stream with the active quantized model.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div key={idx} className={`chat ${isAssistant ? 'chat-start' : 'chat-end'}`}>
                  <div className="chat-image avatar">
                    <div className="w-8 rounded-full bg-base-300 flex items-center justify-center border border-base-300">
                      {isAssistant ? (
                        <Bot className="w-4 h-4 text-primary m-2" />
                      ) : (
                        <User className="w-4 h-4 text-white m-2" />
                      )}
                    </div>
                  </div>
                  
                  <div className="chat-header text-2xs font-mono opacity-50 mb-1 flex items-center gap-2">
                    <span>{isAssistant ? 'Assistant' : 'You'}</span>
                    <time>{msg.timestamp}</time>
                  </div>

                  <div 
                    className={`chat-bubble text-sm leading-relaxed whitespace-pre-wrap select-text ${
                      isAssistant 
                        ? 'bg-base-200 text-base-content border border-base-300 shadow-md' 
                        : 'bg-primary text-black font-medium shadow-md'
                    }`}
                  >
                    {msg.content || (
                      <span className="loading loading-dots loading-xs opacity-70" />
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Box (Generous breathing room, un-squished) */}
        <div className="p-4 bg-base-200/90 border-t border-base-300 shrink-0">
          <div className="flex items-end gap-3 max-w-5xl mx-auto">
            
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your prompt... (Press Enter to send, Shift+Enter for newline)"
                rows={2}
                disabled={isGenerating}
                className="textarea textarea-bordered w-full bg-base-100 text-sm leading-relaxed resize-none focus:border-primary pr-12 shadow-inner"
              />
            </div>

            {isGenerating ? (
              <button
                onClick={handleStop}
                className="btn btn-error h-13 px-5 gap-2 font-bold shadow-md shrink-0"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="btn btn-primary h-13 px-6 gap-2 font-bold shadow-md shrink-0 text-black"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            )}

          </div>
        </div>

      </div>

      {/* Sampling Parameters Sidebar / Drawer */}
      {showDrawer && (
        <aside className="w-full md:w-80 bg-base-200 border-l border-base-300 p-5 flex flex-col gap-6 shrink-0 overflow-y-auto">
          
          <div className="flex items-center gap-2 pb-3 border-b border-base-300">
            <Sliders className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-white">Sampling Settings</h3>
          </div>

          <div className="space-y-5">
            {/* Temperature Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-base-content/80">Temperature</span>
                <span className="font-mono text-primary font-bold">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="range range-primary range-sm"
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                <span>0.0 (Strict)</span>
                <span>0.7</span>
                <span>2.0 (Creative)</span>
              </div>
            </div>

            {/* Top P Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-base-content/80">Top P (Nucleus)</span>
                <span className="font-mono text-primary font-bold">{topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="range range-primary range-sm"
              />
              <div className="flex justify-between text-2xs font-mono text-base-content/50">
                <span>0.05</span>
                <span>0.9</span>
                <span>1.0</span>
              </div>
            </div>

            {/* Max Tokens Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-base-content/80">Max Generation Tokens</span>
                <span className="font-mono text-primary font-bold">{maxTokens}</span>
              </div>
              <input
                type="number"
                min="64"
                max="8192"
                step="64"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 512)}
                className="input input-bordered input-sm w-full bg-base-100 font-mono text-xs"
              />
            </div>

            {/* Stream Output Toggle */}
            <div className="pt-2 border-t border-base-300">
              <label className="label cursor-pointer p-0">
                <span className="label-text text-xs text-base-content/80 font-medium">Stream SSE Tokens</span>
                <input
                  type="checkbox"
                  checked={stream}
                  onChange={(e) => setStream(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-sm"
                />
              </label>
            </div>
          </div>

          <div className="text-2xs text-base-content/60 font-mono p-3 bg-base-300/40 rounded-lg border border-base-300 mt-auto">
            These parameters are dispatched with each request to <code>/v1/chat/completions</code>.
          </div>

        </aside>
      )}

    </div>
  );
}
