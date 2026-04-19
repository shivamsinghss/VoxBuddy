#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.fbx':  'application/octet-stream',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

/* ================================================================
   KICK CONFIG
   ================================================================ */
let kickConfig = { enabled: false };
try {
  kickConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'kick.config.json'), 'utf8'));
} catch {
  // kick.config.json missing or malformed — Kick integration disabled
}

/* ================================================================
   SSE BROADCAST
   ================================================================ */
const sseClients = new Set();
let kickConnected = false;

function broadcastSSE(data) {
  const line = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(line); } catch { /* client disconnected */ }
  }
}

/* ================================================================
   KICK INTEGRATION
   ================================================================ */
function fetchKickChatroomId(channelName) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: 'kick.com',
        path: `/api/v1/channels/${encodeURIComponent(channelName)}`,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; AnimatedChar/1.0)',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            const id = json?.chatroom?.id;
            if (!id) throw new Error(`No chatroom.id in response (status ${res.statusCode})`);
            resolve(id);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Kick API request timed out')); });
  });
}

async function connectKickChat() {
  if (!kickConfig.enabled || !kickConfig.channel) return;

  let WebSocket;
  try {
    WebSocket = require('ws');
  } catch {
    console.error('[Kick] "ws" module not found. Run:  npm install');
    return;
  }

  const key     = kickConfig.pusherKey     || '32cbd69e4b950bf97679';
  const cluster = kickConfig.pusherCluster || 'us2';

  let chatroomId;
  try {
    console.log(`[Kick] Fetching chatroom ID for channel: ${kickConfig.channel}`);
    chatroomId = await fetchKickChatroomId(kickConfig.channel);
    console.log(`[Kick] Chatroom ID: ${chatroomId}`);
  } catch (err) {
    console.error('[Kick] Could not get chatroom ID:', err.message);
    console.error('[Kick] Retrying in 15 s…');
    setTimeout(connectKickChat, 15000);
    return;
  }

  const wsUrl = `wss://ws-${cluster}.pusher.com/app/${key}?protocol=7&client=js&version=7.6.0&flash=false`;
  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error('[Kick] WebSocket creation failed:', err.message);
    setTimeout(connectKickChat, 10000);
    return;
  }

  ws.on('open', () => {
    console.log('[Kick] Connected to Pusher. Subscribing…');
    ws.send(JSON.stringify({
      event: 'pusher:subscribe',
      data:  { auth: '', channel: `chatrooms.${chatroomId}.v2` },
    }));
  });

  ws.on('message', (rawData) => {
    let msg;
    try { msg = JSON.parse(rawData.toString()); } catch { return; }

    switch (msg.event) {
      case 'pusher:ping':
        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        break;

      case 'pusher_internal:subscription_succeeded':
        kickConnected = true;
        console.log(`[Kick] Live on chatrooms.${chatroomId}.v2  (#${kickConfig.channel})`);
        broadcastSSE({ type: 'status', connected: true, channel: kickConfig.channel });
        break;

      case 'App\\Events\\ChatMessageEvent': {
        let chatData;
        try { chatData = JSON.parse(msg.data); } catch { return; }
        broadcastSSE({
          type:     'message',
          username: chatData.sender?.username || 'Anonymous',
          content:  chatData.content          || '',
          color:    chatData.sender?.identity?.color || '#53fc18',
        });
        break;
      }
    }
  });

  ws.on('close', (code, reason) => {
    kickConnected = false;
    console.log(`[Kick] Disconnected (code ${code}). Reconnecting in 5 s…`);
    broadcastSSE({ type: 'status', connected: false });
    setTimeout(connectKickChat, 5000);
  });

  ws.on('error', (err) => {
    console.error('[Kick] WebSocket error:', err.message);
    // 'close' will follow, which handles the reconnect
  });
}

/* ================================================================
   STATIC FILE HELPERS
   ================================================================ */
function listFbx(dirPath) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.toLowerCase().endsWith('.fbx'))
      .sort();
  } catch {
    return [];
  }
}

/* ================================================================
   HTTP SERVER
   ================================================================ */
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  // ── API: list FBX files in IDLE/ folder ──────────────────
  if (urlPath === '/api/files/idle') {
    const files = listFbx(path.join(ROOT, 'IDLE'));
    const body  = JSON.stringify(files);
    res.writeHead(200, {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(body);
  }

  // ── API: list FBX files in animate/ folder ───────────────
  if (urlPath === '/api/files/animate') {
    const files = listFbx(path.join(ROOT, 'animate'));
    const body  = JSON.stringify(files);
    res.writeHead(200, {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(body);
  }

  // ── API: serve Kick/app config ────────────────────────────
  if (urlPath === '/api/config') {
    // Only expose non-sensitive fields to the browser
    const body = JSON.stringify({
      kick: {
        enabled:           kickConfig.enabled           ?? false,
        channel:           kickConfig.channel           || '',
        triggerAnimations: kickConfig.triggerAnimations ?? true,
        showBadge:         kickConfig.showBadge         ?? true,
        commandPrefix:     kickConfig.commandPrefix     || '!',
      },
    });
    res.writeHead(200, {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control':  'no-cache',
    });
    return res.end(body);
  }

  // ── API: Server-Sent Events stream for Kick chat ─────────
  if (urlPath === '/api/kick/events') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    // Tell the browser how long to wait before reconnecting
    res.write('retry: 3000\n\n');
    // Send current connection status immediately
    res.write(`data: ${JSON.stringify({ type: 'status', connected: kickConnected, channel: kickConfig.channel || '' })}\n\n`);

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return; // keep the response open
  }

  // ── Static file serving ───────────────────────────────────
  const normalized = path.normalize(urlPath === '/' ? '/index.html' : urlPath);
  const filePath   = path.join(ROOT, normalized);

  // Path traversal guard
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found: ' + urlPath);
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type':   mime,
      'Content-Length': stat.size,
      'Cache-Control':  'no-cache',
    });

    if (req.method === 'HEAD') return res.end();

    fs.createReadStream(filePath)
      .on('error', () => { if (!res.headersSent) res.end(); })
      .pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const divider = '─'.repeat(44);
  console.log('\n' + divider);
  console.log('  AnimatedChar is running!');
  console.log(divider);
  console.log('  Open:  http://localhost:' + PORT);
  console.log('  Stop:  Ctrl+C');
  console.log(divider + '\n');
  console.log('  IDLE/    → idle animations (loaded automatically)');
  console.log('  animate/ → chat commands   (filename = command)');
  if (kickConfig.enabled) {
    console.log(`\n  Kick:    channel "${kickConfig.channel}" — connecting…`);
  } else {
    console.log('\n  Kick:    disabled (edit kick.config.json to enable)');
  }
  console.log('');

  // Start Kick integration after server is listening
  connectKickChat();
});
