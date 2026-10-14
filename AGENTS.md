# AGENTS.md — Prism Bonsai Runner Development Guidelines

## 1. Modularization & File Size Rule
- **Mandatory File Size Principle**: **If a file gets too big, it must always be modularised, put into a folder of the same name, and aggregated.**
- Examples:
  - When `app.js` grows large, split into `app/` (e.g. `state.js`, `components.js`, `runner.js`, `models.js`, `playground.js`, `logs.js`, `settings.js`) and aggregate in `app/index.js` or `app.js`.
  - When a stylesheet or backend module grows large, split by domain into a folder of the same name and aggregate via an index entry point.

## 2. Reusable Component System
- **Use clean, modular, reusable components everywhere.**
- All UI elements must use authentic **daisyUI** components (Cards, Badges, Stats, Chat Bubbles, Tabs, Modals, Range Sliders, Buttons, Inputs).
- Avoid monolithic, ad-hoc inline styles or copy-pasted HTML blocks.
- Centralize component rendering templates into reusable factory functions (e.g., in `app/components.js`):
  - `createModelCard(model, isActive, isVisionActive)`
  - `createHubCard(model)`
  - `createChatBubble(role, content, timestamp)`
  - `createStatBox(title, value, accent)`
  - `createModalDialog(id, title, content)`

## 3. Tailwind CSS & daisyUI Integration
- daisyUI **must** be installed and used as a Tailwind CSS plugin:
  ```css
  @import "tailwindcss";
  @plugin "daisyui";
  ```
- Compiled via `@tailwindcss/cli`:
  ```bash
  npx @tailwindcss/cli -i src/frontend/input.css -o src/frontend/output.css
  ```
- Always ensure components leverage daisyUI semantic classes (`btn`, `card`, `chat`, `chat-bubble`, `stats`, `badge`, `modal`, `range`, `input`, `textarea`, `alert`).

## 4. UI Theme & Visual Aesthetics
- **Theme**: VS Code & Antigravity IDE Dark Theme (`data-theme="antigravity"`).
- **Color Palette**: Deep dark charcoal/zinc surfaces (`#18181b`, `#101012`, `#222226`), crisp borders (`#27272a`, `#3f3f46`), high-contrast white content (`#f4f4f5`), and vibrant electric blue accents (`#0098ff`, `#38bdf8`). Avoid murky or weird blue-gray washes.
- **Electric Blue**: Primary brand accents, action highlights, active tab top bars, and status rings use vibrant electric blue (`#0098ff`, `#38bdf8`).
- **Roundness Control**:
  - Chat bubbles: Naturally rounded like daisyUI chat (`1rem` with speech tails).
  - General UI (cards, inputs, buttons): Crisp and structured (`border-radius: 6px` to `8px`), never excessively pill-shaped.
- **Layout & Padding**: Generous breathing room, never squish or overflow inputs or terminal streams. Fixed layout viewports (Chat Playground, Live Logs) must use `flex-1 min-h-0` flex containers so headers and inputs never get clipped.
