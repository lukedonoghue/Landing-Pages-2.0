import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/api/enquiry') {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'POST required' });
    let raw = '';
    for await (const part of request) {
      raw += part;
      if (raw.length > 16000) return sendJson(response, 413, { error: 'Request too large' });
    }
    let data;
    try { data = JSON.parse(raw); } catch { return sendJson(response, 400, { error: 'Invalid JSON' }); }
    if (!data || !String(data.name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email || '').trim()) || !String(data.message || '').trim()) {
      return sendJson(response, 422, { error: 'Missing or invalid required details' });
    }
    if (data.phone && (!/^\+?[0-9][0-9 ()-]*(?:\s*(?:ext\.?|x)\s*\d+)?$/i.test(String(data.phone)) || String(data.phone).replace(/\D/g, '').length < 7)) {
      return sendJson(response, 422, { error: 'Invalid phone number' });
    }
    return sendJson(response, 202, { localPreview: true, receipt: `preview-${Date.now().toString(36)}` });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    return response.end();
  }
  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const path = resolve(root, `.${relative}`);
  if (!path.startsWith(root + sep)) {
    response.writeHead(403);
    return response.end();
  }
  try {
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Garden Room Co. local preview: http://127.0.0.1:${port}/`);
});
