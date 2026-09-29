#!/usr/bin/env node
// Zero-dependency static server for the preview page.
//   node tools/serve.mjs [--port 5173]   then open http://localhost:5173/preview/
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { ROOT, parseArgs } from './lib/rig.mjs';

const args = parseArgs(process.argv.slice(2));
const port = Number(args.port) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${path}`);
  }
}).listen(port, () => console.log(`Preview: http://localhost:${port}/preview/`));
