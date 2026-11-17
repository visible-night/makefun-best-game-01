// Lumen Drift — a tiny static server for local playtesting only.
// Serves game/ at http://localhost:8080 so the game can be opened in a
// desktop browser exactly as the judges will serve it. Not part of the entry.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const gameDir = join(dirname(fileURLToPath(import.meta.url)), 'game');
const port = Number(process.env.PORT || 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  const path = normalize(new URL(req.url || '/', 'http://localhost').pathname).replace(/^\/+/, '');
  const file = join(gameDir, path === '' ? 'index.html' : path);
  if (!file.startsWith(gameDir) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => {
  console.log(`Lumen Drift at http://localhost:${port}/`);
});
