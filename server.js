#!/usr/bin/env node
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

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

function listFbx(dirPath) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.toLowerCase().endsWith('.fbx'))
      .sort();
  } catch {
    return [];
  }
}

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
  console.log('  animate/ → chat commands   (filename = command)\n');
});
