// Serves the web export the way Firebase Hosting does: a file that exists is
// served as itself, and every other path gets index.html, so a deep link like
// /events-info/<id> boots the app instead of 404ing. That is the `**` rewrite
// in firebase.json; `expo serve` has no equivalent for a single-page export.
//
// Usage: node e2e/serve.mjs <dir> [port]   (on this machine only, not the LAN)
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 8090);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function fileFor(urlPath) {
  let candidate;
  try {
    candidate = normalize(join(root, decodeURIComponent(urlPath)));
  } catch {
    // A malformed escape names no file; it must not take the server down.
    return null;
  }
  // Refuse anything that escapes the root via ../ — including into a sibling
  // that merely starts with the same name, like dist-old/.
  if (!candidate.startsWith(root + sep)) return null;
  try {
    return statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const file = fileFor(path) ?? join(root, 'index.html');
  const stream = createReadStream(file);
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
}).listen(port, 'localhost', () => console.log(`Serving ${root} on http://localhost:${port}`));
