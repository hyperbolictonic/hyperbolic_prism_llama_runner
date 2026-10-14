const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

// Check for tinyjs in PATH or standard installation directories
const candidates = [
  'tinyjs',
  path.join(process.env.LOCALAPPDATA || '', 'tinyjs', 'tinyjs.cmd'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.tinyjs', 'bin', 'tinyjs'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.tinyjs', 'tinyjs'),
];

let executable = null;
for (const cand of candidates) {
  if (cand === 'tinyjs') {
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${which} tinyjs`, { stdio: 'ignore' });
      executable = 'tinyjs';
      break;
    } catch (e) {}
  } else if (fs.existsSync(cand)) {
    executable = cand;
    break;
  }
}

if (!executable) {
  console.error('\x1b[31m[Error] tinyjs executable could not be found.\x1b[0m');
  console.error('Please install tinyjs using: irm https://tinyjs.app/install.ps1 | iex');
  process.exit(1);
}

let child;
if (process.platform === 'win32') {
  child = spawn('cmd.exe', ['/c', executable, ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
} else {
  child = spawn(executable, args, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
