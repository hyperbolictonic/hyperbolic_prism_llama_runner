# Hyperbolic Prism Llama Runner ⚡🦙

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-blue.svg)](https://github.com/hyperbolictonic/hyperbolic_prism_llama_runner)
[![Engine](https://img.shields.io/badge/Engine-PrismML%20llama.cpp-0098ff.svg)](https://github.com/PrismML-Eng/llama.cpp)
[![UI](https://img.shields.io/badge/Stack-Electron%20%7C%20React%2019%20%7C%20Tailwind%204%20%7C%20daisyUI%205-18181b.svg)](#technology-stack)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A studio-grade desktop runner and model manager engineered specifically for **[PrismML-Eng/llama.cpp](https://github.com/PrismML-Eng/llama.cpp)** and the **PrismML Bonsai** model family (1-bit, ternary, and sub-byte quantized architectures such as *Bonsai-8B*, *Ternary-Bonsai-2-27B*, and *Bonsai-27B* in `Q1_0`, `PQ2_0`, `PTQ1_0`, and standard GGUF formats).

Built with **Electron**, **React 19**, **Vite**, **Tailwind CSS 4**, and **daisyUI 5**, styled in the Antigravity / VS Code deep zinc aesthetic with electric blue accents.

---

## ✨ Key Features

### 1. 🎛️ Server Dashboard & Execution Supervisor
- **Process Supervision**: Spawns and manages `llama-server.exe` with real-time health checks (`/health`) and automatic recovery.
- **Unified Engine Presets**: Couple execution offload with context quantization in a single click:
  - **Studio Balanced (Q8_0)**: 50% KV cache savings, lossless precision, balanced GPU offload.
  - **Max Context (Q4_0)**: 75% KV VRAM savings, enables 64K–256K context on consumer GPUs.
  - **High Fidelity (F16)**: Uncompressed cache for complex code and mathematical reasoning.
  - **Extended RoPE (YaRN)**: Expands attention context beyond native model training window.
- **Dynamic Ceilings**: Context slider automatically adapts its range (up to 256K tokens) based on the architecture of the loaded model.
- **Hardware Telemetry**: Displays GPU VRAM utilization, GPU layers offloaded (`-ngl`), CPU thread allocation (`-t`), and prompt batching throughput (`-b`).

### 2. 🧠 Context Window & KV Cache Optimizer
*Engineered to Atomic Chat & LM Studio standards for maximum context retention.*
- **Live VRAM Footprint Estimator**: Real-time memory calculation and savings percentage compared to uncompressed F16 baselines.
- **Quantized KV Tensors**: Independent precision controls for Key Cache (`-ctk`) and Value Cache (`-ctv`) supporting `q8_0`, `q4_0`, `q4_1`, `q5_0`, `q5_1`, and `f16` (enables 256K context on 16GB consumer GPUs).
- **Unified Batching Pipeline**:
  - **Logical Prompt Batch (`-b`)**: Controls tokens evaluated per ingestion step.
  - **Physical Micro-Batch (`-ub`)**: Regulates physical compute chunk size to prevent VRAM spikes.
  - Automatic `-ub ≤ -b` engine rule enforcement and interactive clamping.
- **Flash Attention (`-fa on`)**: Hardware-accelerated memory management to prevent quadratic memory explosion during long prompt ingest.
- **Context Shifting (`--context-shift`)**: Automatically scrolls older context on limit overflow so conversations never crash.
- **Prompt Cache Reuse (`--cache-reuse`)**: Keeps system prompts and common prefixes in cache across turns for near-instant Time-To-First-Token.
- **RoPE Scaling**: Built-in YaRN and Linear frequency scaling for massive context expansion.

### 3. 📦 Model Manager & Vision Companion Bundling
- **Local Model Library**: Scans your models directory for `.gguf` weights and `.mmproj` vision projectors. Auto-tags quantization formats (`1-bit Q1_0`, `Ternary PQ2_0`, `PTQ1_0`, `Q4_K_M`, etc.).
- **Atomic Model + Vision Bundling**: Automatically pairs base language models (e.g., `Ternary-Bonsai-2-27B-PQ2_0`) with their companion vision projectors (e.g., `Ternary-Bonsai-2-27B-mmproj-BF16`). Features a single **"Activate Model + Vision"** button that atomically assigns both `-m` and `--mmproj`, preventing invalid projector selection errors.
- **Hugging Face Hub Explorer**: Search and browse official PrismML models (`prism-ml/Bonsai-8B-gguf`, `prism-ml/Ternary-Bonsai-2-27B-gguf`, etc.), inspect available quantizations, and download directly with real-time speed meters and progress bars.
- **HF Token Integration**: Built-in Hugging Face token configuration for unthrottled high-speed downloads directly from gated and public repositories.
- **Folder Selector**: Native Windows directory picker for custom storage folders on separate drives.

### 4. 💬 Interactive Chat Playground & Multimodal Testing
- **Streaming Generation**: Token-by-token streaming over the OpenAI-compatible `/v1/chat/completions` API.
- **Multimodal Vision Testing**:
  - **Image Attachment Button**: Attach local `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif` files directly to your prompt.
  - **Clipboard Paste (`Ctrl + V`)**: Instantly paste screenshots directly into the prompt box for rapid inspection.
  - **Staged Attachment Preview**: Shows thumbnail chips with file size, vision badges, and remove actions before sending.
  - **Click-to-Expand Preview**: Full-screen modal viewer for high-resolution inspection of uploaded images in chat bubbles.
  - **Automated Grounding**: Automatically injects `--image-min-tokens 1024` for high-fidelity vision reasoning on Qwen-VL / Bonsai architectures.
- **Live Inference Telemetry**:
  - **TPS (Tokens / Second)**
  - **TTFT (Time to First Token)**
  - **Total Tokens Evaluated**
- **Inference Levers**: Fine-tune System Prompt, Temperature, Top-P, and Max Tokens on the fly.

### 5. 📜 Live Server Logs
- Virtualized terminal stream displaying real-time stdout and stderr output from `llama-server.exe`.
- Level filtering (All, Info, Warning, Error), regex search, auto-scroll toggle, and copy-to-clipboard.

### 6. 🚀 Hardware-Aware Binary Installer & Supervision
- **Hardware Detection**: Automatically detects installed NVIDIA GeForce/RTX, AMD Radeon, or CPU environments.
- **Reliable Windows DLL Injection**: Automatically resolves and prepends runtime binary directories (`ggml.dll`, `ggml-cuda.dll`, `llama.dll`) into the execution environment to eliminate silent startup crashes.
- **Extended Health Readiness**: Configurable 120-second readiness polling accommodating large 27B model loads into VRAM.
- **1-Click Binary Installer**: Fetches pre-compiled PrismML runtime packages directly from GitHub releases:
  - **NVIDIA CUDA 13.3 / 12.4** (with companion CUDA runtime DLLs automatically unpacked)
  - **Vulkan** (Cross-GPU acceleration)
  - **CPU (AVX2/Zen4)**

### 7. 🌐 Network & LAN Access (Multi-Node Sharing)
- **Top Bar LAN Toggle**: Dedicated switch in the top header toggling between **Local Only** (`127.0.0.1`) and **LAN Mode** (`0.0.0.0`) with automatic server restart.
- **Auto LAN IP Discovery**: Automatically resolves the host machine's active IPv4 network interface.
- **Click-to-Copy LAN Endpoint**: Click the network pill in the top bar to instantly copy the remote OpenAI API URL (`http://<LAN-IP>:<PORT>/v1`).
- **Port 9931 & 8080 Presets**: Quick-select buttons in Settings for standard `8080` and upcoming default port `9931`.
- **Windows Client Normalization**: Transparently redirects in-app playground and health queries to loopback when bound to `0.0.0.0`, eliminating Windows `WSAEADDRNOTAVAIL` socket errors.

---

## 🛠️ Technology Stack

- **Desktop Framework**: Electron 41 with secure context isolation and IPC architecture
- **Frontend**: React 19, Vite 8, Tailwind CSS 4, daisyUI 5
- **Icons**: Lucide React
- **Engine**: PrismML llama.cpp (`llama-server.exe`)

---

## 🚀 Getting Started

### Prerequisites
- Windows 10/11 x64
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (or `npm`)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/hyperbolictonic/hyperbolic_prism_llama_runner.git
   cd hyperbolic_prism_llama_runner
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start in Development Mode**:
   ```bash
   pnpm dev
   ```

4. **Build Production Application**:
   ```bash
   pnpm build
   ```

---

## 🌐 Accessing from Other Nodes on Your Network

To access the inference engine from other PCs, laptops, mobile devices, or servers on your local network (LAN):

### 1. Enable LAN Mode
- Click the **LAN Mode** toggle switch in the top navigation bar (or choose **0.0.0.0 (LAN)** in **Settings** > **Server Parameters**).
- If the server is running, it will automatically restart and bind to `0.0.0.0`.

### 2. Configure Port (8080 or 9931)
- In **Settings** > **Server Parameters**, use the quick preset buttons to select:
  - **`8080 (Standard)`**: Traditional default port for llama.cpp instances.
  - **`9931 (Next Default)`**: Dedicated port standardized for upcoming Prism releases.

### 3. Open Windows Defender Firewall
Run PowerShell as Administrator to allow inbound connections on your chosen port:

```powershell
# For Port 8080:
New-NetFirewallRule -DisplayName "Prism Llama Server (8080)" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow

# For Port 9931 (Upcoming default):
New-NetFirewallRule -DisplayName "Prism Llama Server (9931)" -Direction Inbound -LocalPort 9931 -Protocol TCP -Action Allow
```

### 4. Connect from Remote Nodes
Click the LAN address pill in the top navbar to copy your endpoint, or use the URLs below from any device on your LAN:

| Purpose | URL Format | Example |
|---|---|---|
| **OpenAI API Base** | `http://<LAN-IP>:<PORT>/v1` | `http://192.168.5.101:9931/v1` |
| **Chat Completions** | `http://<LAN-IP>:<PORT>/v1/chat/completions` | `http://192.168.5.101:9931/v1/chat/completions` |
| **Web UI** | `http://<LAN-IP>:<PORT>/` | `http://192.168.5.101:9931/` |
| **Health Check** | `http://<LAN-IP>:<PORT>/health` | `http://192.168.5.101:9931/health` |

---

## ⚙️ Configuration

Settings and server states are persisted in `runner-config.json` at the root directory:

```json
{
  "host": "0.0.0.0",
  "port": 9931,
  "ctxSize": 16384,
  "nGl": 28,
  "threads": 8,
  "batchSize": 512,
  "uBatchSize": 512,
  "cacheTypeK": "q8_0",
  "cacheTypeV": "q8_0",
  "flashAttn": true,
  "ctxShift": true,
  "cacheReuse": 256,
  "ropeScaling": "none",
  "modelsDir": "models",
  "binaryPath": "bin/prism-llama/llama-server.exe"
}
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Model weights and PrismML kernels are subject to their respective upstream licenses.
