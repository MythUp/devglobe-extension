#!/usr/bin/env node
/**
 * tcp-bridge.js — Bridge between devglobe-core daemon (stdin/stdout) and TCP.
 *
 * Usage: node tcp-bridge.js <port> [core-binary]
 *
 * Listens on 127.0.0.1:<port>, spawns devglobe-core daemon as a child process,
 * and forwards JSON lines between TCP clients and the daemon's stdin/stdout.
 *
 * Protocol:
 *   - TCP client sends JSON lines (same as daemon stdin protocol)
 *   - Daemon stdout JSON lines are forwarded back to ALL connected TCP clients
 *   - Multiple clients can connect; each receives all daemon events
 */

const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.argv[2] || '0', 10);
const CORE_BIN = process.argv[3] || 'devglobe-core';

if (!PORT || PORT < 1 || PORT > 65535) {
  console.error('Usage: node tcp-bridge.js <port> [core-binary]');
  process.exit(1);
}

// --- Find core binary ---
function findCore() {
  if (CORE_BIN !== 'devglobe-core') return CORE_BIN;

  // Try common locations
  const isWin = process.platform === 'win32';
  const homeDir = isWin
    ? process.env.USERPROFILE || process.env.HOMEPATH
    : process.env.HOME;

  const candidates = [
    path.join(homeDir, '.devglobe', 'core', 'devglobe-core.js'),
    path.join(homeDir, '.devglobe', 'core', 'devglobe-core'),
  ];

  // Also check npm global bin
  const npmBin = isWin
    ? path.join(process.env.APPDATA || '', 'npm', 'devglobe-core.cmd')
    : path.join('/usr', 'local', 'bin', 'devglobe-core');

  candidates.push(npmBin);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return 'devglobe-core'; // fallback to PATH
}

const corePath = findCore();
const isJs = corePath.endsWith('.js');
const isCmd = corePath.endsWith('.cmd');

// Resolve .cmd wrappers to the underlying .js file to avoid shell:true (DEP0190)
let resolvedPath = corePath;
let resolvedIsJs = isJs;
if (isCmd) {
  const npmLib = path.join(path.dirname(corePath), 'node_modules', 'devglobe-core', 'dist', 'devglobe-core.js');
  if (fs.existsSync(npmLib)) {
    resolvedPath = npmLib;
    resolvedIsJs = true;
  }
}

const daemon = spawn(
  resolvedIsJs ? process.execPath : resolvedPath,
  resolvedIsJs ? [resolvedPath, 'daemon'] : ['daemon'],
  {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  }
);

daemon.on('error', (err) => {
  console.error(`[bridge] Failed to spawn daemon: ${err.message}`);
  server.close();
  process.exit(1);
});

daemon.on('exit', (code) => {
  console.error(`[bridge] Daemon exited with code ${code}`);
  for (const sock of clients) {
    sock.write(JSON.stringify({ event: 'daemon_exit', data: { code } }) + '\n');
  }
  server.close();
  process.exit(code || 0);
});

daemon.stderr.on('data', (data) => {
  // Forward daemon stderr to bridge stderr for debugging
  process.stderr.write(data);
});

// --- TCP Server ---
const clients = new Set();

const server = net.createServer((socket) => {
  clients.add(socket);
  console.error(`[bridge] Client connected (${clients.size} total)`);

  socket.on('data', (buf) => {
    // Forward client messages to daemon stdin
    const lines = buf.toString().split('\n').filter((l) => l.trim());
    for (const line of lines) {
      daemon.stdin.write(line.trim() + '\n');
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
    console.error(`[bridge] Client disconnected (${clients.size} remaining)`);
  });

  socket.on('error', (err) => {
    console.error(`[bridge] Socket error: ${err.message}`);
    clients.delete(socket);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = server.address();
  // Write the actual port to stdout so the Godot plugin can read it
  // Format: BRIDGE_READY:<port>
  console.log(`BRIDGE_READY:${addr.port}`);
  console.error(`[bridge] Listening on 127.0.0.1:${addr.port}`);
});

// --- Forward daemon stdout to all TCP clients ---
let buffer = '';
daemon.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete line

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const sock of clients) {
      try {
        sock.write(trimmed + '\n');
      } catch (e) {
        // socket may have closed
      }
    }
  }
});

// --- Graceful shutdown ---
function shutdown() {
  daemon.stdin.write(JSON.stringify({ method: 'shutdown' }) + '\n');
  setTimeout(() => {
    daemon.kill();
    server.close();
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
