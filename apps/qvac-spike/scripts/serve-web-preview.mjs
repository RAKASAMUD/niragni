/**
 * Loopback-only static server for the exported Niragni WEB PREVIEW (DEMO).
 *
 * Serves the `expo export --platform web` output from dist-web, bound EXPLICITLY
 * to the IPv4 loopback address 127.0.0.1 (never 0.0.0.0 / LAN / tunnel / cloud).
 * SPA fallback: unknown non-asset routes return index.html so expo-router's
 * client-side routes (e.g. /report/<id>/edit) resolve. No framework, no paid
 * hosting, no extra processes. Stop with Ctrl+C.
 *
 * Usage: node scripts/serve-web-preview.mjs [port]
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..', 'dist-web');
const HOST = '127.0.0.1'; // loopback only — do not change to 0.0.0.0
const PORT = Number(process.argv[2] || 8082);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function contentType(p) {
  return TYPES[extname(p).toLowerCase()] || 'application/octet-stream';
}

/** Resolve a URL path to a file inside ROOT, blocking traversal. */
function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = normalize(clean).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = join(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null; // path traversal guard
  return abs;
}

async function tryFile(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return null;
    return await readFile(p);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = req.url || '/';
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const abs = safePath(urlPath);
    if (!abs) {
      res.writeHead(400).end('Bad request');
      return;
    }

    let body = await tryFile(abs);
    let servedPath = abs;

    // SPA fallback: for a non-asset route (no file extension) serve index.html
    // so client-side router paths resolve on reload / deep link.
    if (body === null && extname(abs) === '') {
      servedPath = join(ROOT, 'index.html');
      body = await tryFile(servedPath);
    }

    if (body === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType(servedPath),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Server error: ${e}`);
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Niragni WEB PREVIEW (DEMO) serving ${ROOT}`);
  // eslint-disable-next-line no-console
  console.log(`Loopback only: http://${HOST}:${PORT}  (PID ${process.pid})`);
});
