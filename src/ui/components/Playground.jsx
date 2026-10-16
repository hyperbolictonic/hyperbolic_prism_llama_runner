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
  ChevronUp,
  Image as ImageIcon,
  Paperclip,
  X,
  Eye
} from 'lucide-react';

export default function Playground() {
  const { serverStatus, config } = useApp();
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am ready to assist. You can type a prompt below, or attach an image to test multimodal vision capabilities with --mmproj.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null); // { file, dataUrl, name, size }
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);
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
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;
  };

  const processImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      if (window.tiny && window.tiny.dialog) {
        window.tiny.dialog.alert('Invalid File', 'Please select a valid image file (PNG, JPEG, WebP, GIF).');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachedImage({
        file,
        dataUrl: e.target.result,
        name: file.name,
        size: formatFileSize(file.size),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachedImage = () => {
    setAttachedImage(null);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if ((!text && !attachedImage) || isGenerating) return;

    if (!serverStatus.running) {
      if (window.tiny && window.tiny.dialog) {
        window.tiny.dialog.alert('Server Not Running', 'Please start the inference server in the Supervisor or Navbar before sending messages.');
      } else {
        alert('Please start the inference server first.');
      }
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { 
      role: 'user', 
      content: text || (attachedImage ? 'Describe this image in detail.' : ''), 
      image: attachedImage ? attachedImage.dataUrl : null,
      timestamp: timeStr 
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setAttachedImage(null);

    // Prepare assistant placeholder
    const assistantMsg = { role: 'assistant', content: '', timestamp: timeStr };
    setMessages(prev => [...prev, assistantMsg]);

    setIsGenerating(true);
    setTtft(null);
    setTps(null);
    setTokensCount(0);

    const rawHost = serverStatus.host || config.host || '127.0.0.1';
    const host = rawHost === '0.0.0.0' ? '127.0.0.1' : rawHost;
    const port = serverStatus.port || config.port || 8080;
    const endpoint = `http://${host}:${port}/v1/chat/completions`;

    // OpenAI multimodal chat completions structure for llama-server --mmproj
    const chatPayload = [
      { role: 'system', content: systemPrompt },
      ...nextMessages.map(m => {
        if (m.image) {
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content || 'Describe this image in detail.' },
              { type: 'image_url', image_url: { url: m.image } }
            ]
          };
        }
        return { role: m.role, content: m.content };
      })
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
                    {msg.image && (
                      <div className="mb-2">
                        <img 
                          src={msg.image} 
                          alt="Uploaded user visual input" 
                          className="max-w-xs max-h-56 rounded-md border border-black/20 object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                          onClick={() => setSelectedPreviewImage(msg.image)}
                          title="Click to view full image"
                        />
                      </div>
                    )}
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
          <div className="max-w-5xl mx-auto space-y-2.5">
            
            {/* Staged Image Attachment Chip */}
            {attachedImage && (
              <div className="flex items-center gap-2.5 bg-base-100 border border-primary/40 rounded-lg p-2 w-fit shadow-md animate-fade-in">
                <img 
                  src={attachedImage.dataUrl} 
                  alt="Attachment preview" 
                  className="w-12 h-12 object-cover rounded border border-base-300 cursor-pointer"
                  onClick={() => setSelectedPreviewImage(attachedImage.dataUrl)}
                  title="Click to preview"
                />
                <div className="flex flex-col text-xs pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white max-w-[180px] truncate">{attachedImage.name}</span>
                    <span className="badge badge-primary badge-xs font-mono font-bold">Vision</span>
                  </div>
                  <span className="text-2xs text-base-content/60 font-mono mt-0.5">{attachedImage.size}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachedImage}
                  className="btn btn-ghost btn-xs btn-circle text-base-content/70 hover:text-error hover:bg-base-200"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2.5">
              
              {/* Hidden Native File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
              />

              {/* Attach Image Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className={`btn btn-sm h-12 px-3.5 gap-2 border border-base-300 shadow-sm transition-all ${
                  attachedImage 
                    ? 'btn-primary text-black font-bold' 
                    : 'btn-neutral bg-base-100 hover:bg-base-300 text-base-content'
                }`}
                title={
                  config.selectedMmproj 
                    ? "Attach an image to test vision projector (--mmproj active)" 
                    : "Attach an image for vision testing (make sure an mmproj model is selected)"
                }
              >
                <ImageIcon className="w-4 h-4 text-primary fill-primary/20" />
                <span className="hidden sm:inline text-xs font-semibold">Image</span>
              </button>

              <div className="flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={
                    attachedImage 
                      ? "Ask a question about this image... (e.g. 'Describe what you see', 'What text is in this image?')"
                      : "Type your prompt... (Press Enter to send, Shift+Enter for newline, or paste image with Ctrl+V)"
                  }
                  rows={2}
                  disabled={isGenerating}
                  className="textarea textarea-bordered w-full bg-base-100 text-sm leading-relaxed resize-none focus:border-primary pr-12 shadow-inner"
                />
              </div>

              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="btn btn-error h-12 px-5 gap-2 font-bold shadow-md shrink-0"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() && !attachedImage}
                  className="btn btn-primary h-12 px-6 gap-2 font-bold shadow-md shrink-0 text-black"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              )}

            </div>
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

      {/* Image Full-Size Preview Modal */}
      {selectedPreviewImage && (
        <div 
          className="modal modal-open bg-black/85 backdrop-blur-sm z-50 p-4 flex items-center justify-center cursor-pointer animate-fade-in"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-base-200 border border-base-300 rounded-xl p-2 shadow-2xl flex flex-col items-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="btn btn-sm btn-circle btn-neutral absolute -top-3 -right-3 shadow-lg border border-base-300 text-white hover:text-error"
              title="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
            <img 
              src={selectedPreviewImage} 
              alt="Expanded preview" 
              className="max-w-full max-h-[82vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
}
