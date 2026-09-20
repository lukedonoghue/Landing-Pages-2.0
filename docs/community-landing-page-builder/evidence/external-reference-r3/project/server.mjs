import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === '/api/enquiries') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 16000) return json(res, 413, { error: 'too_large' });
    }
    let data;
    try { data = JSON.parse(raw); } catch { return json(res, 400, { error: 'invalid_json' }); }
    if (!data || typeof data.name !== 'string' || !data.name.trim() ||
        typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
        typeof data.message !== 'string' || !data.message.trim() ||
        typeof data.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.requestId)) {
      return json(res, 400, { error: 'invalid_enquiry' });
    }
    return json(res, 200, { status: 'preview-confirmed', requestId: data.requestId });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method_not_allowed' });
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'styles.css', 'script.js'].includes(file) && !/^assets\/[a-zA-Z0-9/_-]+\.(png|webp|ttf|txt)$/.test(file)) {
    return json(res, 404, { error: 'not_found' });
  }
  try {
    const content = await readFile(join(root, file));
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Content-Length': content.length,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': file === 'index.html' ? 'no-store' : 'public, max-age=3600'
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    json(res, 404, { error: 'not_found' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://127.0.0.1:${port}/`);
});
