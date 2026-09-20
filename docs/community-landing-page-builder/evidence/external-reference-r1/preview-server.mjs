import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('./project/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
let accepted = 0;

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/__qa/count' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ accepted }));
    return;
  }
  if (pathname === '/api/enquiry' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 16000) {
        response.writeHead(413);
        response.end();
        return;
      }
    }
    try {
      const data = JSON.parse(body);
      if (!data.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) throw new Error('Invalid fields');
      accepted += 1;
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ accepted: true, preview: true, receipt: randomUUID() }));
    } catch {
      response.writeHead(422, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ accepted: false }));
    }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end();
    return;
  }
  const publicPath = pathname === '/' ? '/index.html' : pathname;
  if (!/^\/(?:index\.html|styles\.css|script\.js|assets\/[\w./-]+)$/.test(publicPath)) {
    response.writeHead(404);
    response.end();
    return;
  }
  const file = resolve(root, `.${publicPath}`);
  if (!file.startsWith(root + sep)) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end();
    else response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Local preview: http://127.0.0.1:${port}/\n`);
});
