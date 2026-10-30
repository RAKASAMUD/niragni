/**
 * Loopback-only static server for the redesigned-UI web review (dist-ui-review).
 *
 * Separate from the user's dist-web preview server (port 8082) so this review
 * never disturbs it. Binds explicitly to 127.0.0.1 (no LAN/tunnel/cloud), serves
 * the `expo export --platform web --output-dir dist-ui-review` output with correct
 * content types, and falls back to index.html for client-side router routes.
 *
 * Usage: node scripts/serve-ui-review.mjs [port]   (default 8083)
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..', 'dist-ui-review');
const HOST = '127.0.0.1'; // loopback only — do not change to 0.0.0.0
const PORT = Number(process.argv[2] || 8083);

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

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = normalize(clean).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = join(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null;
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
    if (!abs) { res.writeHead(400).end('Bad request'); return; }

    let body = await tryFile(abs);
    let servedPath = abs;
    if (body === null && extname(abs) === '') {
      servedPath = join(ROOT, 'index.html');
      body = await tryFile(servedPath);
    }
    if (body === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(servedPath), 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Server error: ${e}`);
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Niragni UI REVIEW (redesign) serving ${ROOT}`);
  // eslint-disable-next-line no-console
  console.log(`Loopback only: http://${HOST}:${PORT}  (PID ${process.pid})`);
});
