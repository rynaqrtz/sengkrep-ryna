const http         = require('http');
const https        = require('https');
const net          = require('net');
const zlib         = require('zlib');
const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

let flakyCount = 0;

const CERT_PATH = path.join(__dirname, '.cert.pem');
const KEY_PATH  = path.join(__dirname, '.key.pem');

function ensureCert() {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    return { cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) };
  }
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 825 -nodes -subj "/CN=127.0.0.1"`,
      { stdio: 'pipe' },
    );
    return { cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) };
  } catch {
    return null;
  }
}

function handler(req, res) {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1 id="title">Hello Ryna</h1><span class="price">£12.99</span></body></html>');
  }

  if (url.pathname === '/json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: { items: [{ title: 'A' }, { title: 'B' }], user: { name: 'qrtz' } } }));
  }

  if (url.pathname === '/json-no-ct') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(JSON.stringify({ ok: true, n: 42 }));
  }

  if (url.pathname === '/gzip') {
    const body = Buffer.from('<h1>gzipped content</h1>');
    const gz   = zlib.gzipSync(body);
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
    return res.end(gz);
  }

  if (url.pathname === '/redirect') {
    res.writeHead(302, { Location: '/html' });
    return res.end();
  }

  if (url.pathname === '/redirect-loop') {
    res.writeHead(302, { Location: '/redirect-loop' });
    return res.end();
  }

  if (url.pathname === '/setcookie') {
    res.writeHead(200, { 'Set-Cookie': ['session=abc123; Path=/', 'theme=dark; Path=/'], 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname === '/checkcookie') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ cookie: req.headers['cookie'] || null }));
  }

  if (url.pathname === '/slow') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>slow</h1>');
    }, 3000);
    return;
  }

  if (url.pathname === '/flaky') {
    flakyCount++;
    if (flakyCount < 3) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('Service Unavailable');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ attempt: flakyCount }));
  }

  if (url.pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.writeHead(200, { 'Set-Cookie': 'authed=1; Path=/', 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: body }));
    });
    return;
  }

  if (url.pathname === '/echo-headers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ headers: req.headers, query: Object.fromEntries(url.searchParams) }));
  }

  if (url.pathname === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    return res.end('<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:9911/html</loc></url><url><loc>http://127.0.0.1:9911/json</loc></url></urlset>');
  }

  if (url.pathname === '/sitemap-index.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    return res.end('<?xml version="1.0"?><sitemapindex><sitemap><loc>http://127.0.0.1:9911/sitemap-a.xml</loc></sitemap><sitemap><loc>http://127.0.0.1:9911/sitemap-b.xml</loc></sitemap></sitemapindex>');
  }

  if (url.pathname === '/sitemap-a.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    return res.end('<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:9911/a1</loc></url></urlset>');
  }

  if (url.pathname === '/sitemap-b.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    return res.end('<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:9911/b1</loc></url></urlset>');
  }

  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('User-agent: *\nSitemap: http://127.0.0.1:9911/sitemap.xml\n');
  }

  if (url.pathname === '/items') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<div class="card" data-id="1"><span class="t">Item One</span></div><div class="card" data-id="2"><span class="t">Item Two</span></div><a class="next-link" href="/items2">next</a>');
  }

  if (url.pathname === '/items2') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<div class="card" data-id="3"><span class="t">Item Three</span></div>');
  }

  res.writeHead(404);
  res.end('not found');
}

const httpServer = http.createServer(handler);

const cert        = ensureCert();
const httpsServer = cert ? https.createServer(cert, handler) : null;

const proxyServer = http.createServer((req, res) => {
  let target;
  try {
    target = new URL(req.url);
  } catch {
    res.writeHead(400);
    return res.end('proxy expects absolute-URI request target');
  }

  const upstreamReq = http.request({
    hostname: target.hostname,
    port:     target.port || 80,
    path:     `${target.pathname}${target.search}`,
    method:   req.method,
    headers:  req.headers,
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', () => { res.writeHead(502); res.end('bad gateway'); });
  req.pipe(upstreamReq);
});

proxyServer.on('connect', (req, clientSocket, head) => {
  const [host, port] = req.url.split(':');
  const upstream = net.connect(parseInt(port, 10), host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => upstream.destroy());
});

const listeners = [
  new Promise(r => httpServer.listen(9911, '127.0.0.1', r)),
  new Promise(r => proxyServer.listen(9913, '127.0.0.1', r)),
];

if (httpsServer) {
  listeners.push(new Promise(r => httpsServer.listen(9912, '127.0.0.1', r)));
}

const ready = Promise.all(listeners).then(() => ({ httpsAvailable: !!httpsServer }));

function closeAll() {
  httpServer.close();
  proxyServer.close();
  if (httpsServer) httpsServer.close();
}

module.exports = { ready, closeAll };
