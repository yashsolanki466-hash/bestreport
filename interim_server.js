import http from 'http';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApi } from './dist/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5174;
const STATIC_DIR = path.join(__dirname, 'interim_app', 'dist');

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html';
  if (ext === '.css') return 'text/css';
  if (ext === '.js') return 'application/javascript';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.json') return 'application/json';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 1. Handle API requests
  if (pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, () => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      });
    } catch (err) {
      console.error('API Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
    return;
  }

  // 2. Serve static files (interim_app/dist)
  let relativeFilePath = pathname === '/' ? 'index.html' : pathname;
  let fullPath = path.join(STATIC_DIR, relativeFilePath);

  // Security: check path traversal
  if (!fullPath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const exists = await fs.pathExists(fullPath);
  if (!exists) {
    // SPA fallback: serve index.html for unknown routes
    fullPath = path.join(STATIC_DIR, 'index.html');
  }

  try {
    const mime = getMimeType(fullPath);
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end('Error loading asset');
  }
});

server.listen(PORT, () => {
  console.log(`Interim Report Builder active for production at: http://localhost:${PORT}`);
});
