// Minimal static file server for local play and for the screenshot pass.
// ES modules refuse to load from file:// origins, so the game is served over HTTP instead.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../game/', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4321);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const target = resolve(join(ROOT, pathname));
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, {
      'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`costa dorada: http://127.0.0.1:${PORT}/`);
});