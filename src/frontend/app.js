// Prism Bonsai Runner - Frontend Entry Point
// Aggregates modularized modules from ./app/
import { initApp } from './app/index.js';

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
