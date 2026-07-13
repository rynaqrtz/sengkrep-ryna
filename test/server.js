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
    return res.end('User-agent: *\nDisallow: /private/\nAllow: /private/public-page\nCrawl-delay: 2\nSitemap: http://127.0.0.1:9911/sitemap.xml\n\nUser-agent: badbot\nDisallow: /\n');
  }

  if (url.pathname === '/items') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<div class="card" data-id="1"><span class="t">Item One</span></div><div class="card" data-id="2"><span class="t">Item Two</span></div><a class="next-link" href="/items2">next</a>');
  }

  if (url.pathname === '/items2') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<div class="card" data-id="3"><span class="t">Item Three</span></div>');
  }

  if (url.pathname === '/etag') {
    const currentEtag = '"v1-etag-abc"';
    if (req.headers['if-none-match'] === currentEtag) {
      res.writeHead(304, { ETag: currentEtag });
      return res.end();
    }
    res.writeHead(200, { ETag: currentEtag, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ content: 'fresh data', version: 1 }));
  }

  if (url.pathname === '/protected') {
    const auth = req.headers['authorization'];
    if (auth !== 'Bearer valid-token') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthorized' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ secret: 'top-data' }));
  }

  if (url.pathname === '/csrf-login') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html><head><meta name="csrf-token" content="csrf-secret-xyz"></head><body><form><input type="hidden" name="_token" value="csrf-secret-xyz"></form></body></html>');
    }
    if (req.method === 'POST') {
      const header = req.headers['x-csrf-token'];
      if (header !== 'csrf-secret-xyz') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'csrf mismatch' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  if (url.pathname === '/feed.xml') {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    return res.end('<?xml version="1.0"?><rss version="2.0"><channel><title>Test Feed</title><item><title>Post One</title><link>http://127.0.0.1:9911/post-1</link><pubDate>Mon, 01 Jun 2026 00:00:00 GMT</pubDate><description>First post</description></item><item><title>Post Two</title><link>http://127.0.0.1:9911/post-2</link><pubDate>Tue, 02 Jun 2026 00:00:00 GMT</pubDate><description>Second post</description></item></channel></rss>');
  }

  if (url.pathname === '/data.csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv' });
    return res.end('name,price\n"Buku A",50000\n"Buku B, edisi 2",75000\n');
  }

  if (url.pathname === '/wp-json/wp/v2/posts') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-WP-Total': '2', 'X-WP-TotalPages': '1' });
    return res.end(JSON.stringify([{ id: 1, title: { rendered: 'Hello WP' } }, { id: 2, title: { rendered: 'World WP' } }]));
  }

  if (url.pathname === '/wp-admin/admin-ajax.php' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      if (params.get('_ajax_nonce') !== 'wp-nonce-123') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, data: 'invalid nonce' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { action: params.get('action') } }));
    });
    return;
  }

  if (url.pathname === '/wp-page') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><head><script>var ajax_object = {"ajax_url":"\\/wp-admin\\/admin-ajax.php","nonce":"wp-nonce-123"};</script></head><body>page</body></html>');
  }

  if (url.pathname === '/crawl-a') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Page A</h1><a href="/crawl-b">b</a><a href="/crawl-c">c</a></body></html>');
  }

  if (url.pathname === '/crawl-b') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Page B</h1><a href="/crawl-d">d</a></body></html>');
  }

  if (url.pathname === '/crawl-c') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Page C</h1></body></html>');
  }

  if (url.pathname === '/crawl-d') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Page D</h1></body></html>');
  }

  if (url.pathname === '/graphql' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (parsed.query && parsed.query.includes('__schema')) {
        return res.end(JSON.stringify({ data: { __schema: { queryType: { name: 'Query' }, types: [{ name: 'Product', kind: 'OBJECT', fields: [{ name: 'id', type: { name: 'ID' } }, { name: 'title', type: { name: 'String' } }] }] } } }));
      }
      return res.end(JSON.stringify({ data: { products: { edges: [{ node: { id: '1', title: 'A' } }, { node: { id: '2', title: 'B' } }], pageInfo: { hasNextPage: false, endCursor: null } } } }));
    });
    return;
  }

  if (url.pathname === '/fallback-html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><div class="new-title-class">Fallback Title</div><span class="price-v2">Rp99.000</span></body></html>');
  }

  if (url.pathname === '/paginated-widget') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Widget Page</h1><nav class="pagination"><a class="page-numbers" href="/p1">1</a><a class="page-numbers" href="/p2">2</a><a class="page-numbers" href="/p3">3</a><a class="next page-numbers" href="/p2">Next</a></nav></body></html>');
  }

  if (url.pathname === '/structured') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Sepatu Ryna","offers":{"@type":"Offer","price":"250000"}}</script><div itemscope itemtype="https://schema.org/Person"><span itemprop="name">Budi</span><span itemprop="jobTitle">Developer</span></div><div data-product-id="42" data-in-stock="true">card</div></body></html>');
  }

  if (url.pathname === '/binary-image') {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    return res.end(png);
  }

  if (url.pathname === '/shift-jis') {
    const iconvBuf = Buffer.from('<html><body><h1>\x82\xb1\x82\xf1\x82\xc9\x82\xbf\x82\xcd</h1></body></html>', 'binary');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=Shift_JIS' });
    return res.end(iconvBuf);
  }

  if (url.pathname === '/jsonp') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end('myCallback({"status":"ok","value":42});');
  }

  if (url.pathname === '/simple-form') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><form action="/simple-form-submit" method="POST"><input type="hidden" name="_token" value="form-tok-1"><input type="text" name="q" value="default"></form></body></html>');
  }

  if (url.pathname === '/simple-form-submit' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ q: params.get('q'), token: params.get('_token') }));
    });
    return;
  }

  if (url.pathname === '/large-file') {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    const chunk = Buffer.alloc(1024 * 1024, 'a');
    let sent = 0;
    const total = 12 * 1024 * 1024;
    const pump = () => {
      while (sent < total) {
        const ok = res.write(chunk);
        sent += chunk.length;
        if (!ok) { res.once('drain', pump); return; }
      }
      res.end();
    };
    pump();
    return;
  }

  if (url.pathname === '/zstd-real') {
    const zlib = require('zlib');
    const payload = zlib.zstdCompressSync(Buffer.from(JSON.stringify({ via: 'zstd', ok: true })));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'zstd' });
    return res.end(payload);
  }

  if (url.pathname === '/bogus-encoding') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'bogus-xyz' });
    return res.end(JSON.stringify({ should: 'never-parse-raw' }));
  }

  if (url.pathname === '/inference-list') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<html><body>
      <div class="product-card"><h2 class="product-title">Sepatu Lari</h2><span class="product-price">Rp450.000</span><img class="product-image" src="/img1.jpg"><a class="product-link" href="/p/1">lihat</a></div>
      <div class="product-card"><h2 class="product-title">Tas Ransel</h2><span class="product-price">Rp275.000</span><img class="product-image" src="/img2.jpg"><a class="product-link" href="/p/2">lihat</a></div>
      <div class="product-card"><h2 class="product-title">Jaket Hoodie</h2><span class="product-price">Rp320.000</span><img class="product-image" src="/img3.jpg"><a class="product-link" href="/p/3">lihat</a></div>
      </body></html>`);
  }

  if (url.pathname === '/inference-single') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<html><body>
      <h1 class="article-title">Cara Membuat Kopi Enak</h1>
      <span class="article-date">2026-06-15</span>
      <div class="article-author">Budi Santoso</div>
      <div class="article-content">Ini adalah artikel tentang cara membuat kopi yang enak dan nikmat setiap pagi.</div>
      </body></html>`);
  }

  if (url.pathname === '/retry-after-seconds') {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '1' });
    return res.end(JSON.stringify({ error: 'slow down' }));
  }

  if (url.pathname === '/truncated') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{"incomplete": "data"');
    setImmediate(() => res.destroy());
    return;
  }

  if (url.pathname === '/private/secret') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<h1>secret</h1>');
  }

  if (url.pathname === '/private/public-page') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<h1>allowed</h1>');
  }

  if (url.pathname === '/public-page') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<h1>public</h1>');
  }

  if (url.pathname === '/rate-limited-api') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'RateLimit-Limit': '100', 'RateLimit-Remaining': '3', 'RateLimit-Reset': '60' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname === '/dup-page-1') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Item A</h1><a class="next" href="/dup-page-2">next</a></body></html>');
  }

  if (url.pathname === '/dup-page-2') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Item B</h1><a class="next" href="/dup-page-3">next</a></body></html>');
  }

  if (url.pathname === '/dup-page-3') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Item B</h1><a class="next" href="/dup-page-3b">next</a></body></html>');
  }

  if (url.pathname === '/dup-page-3b') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Item B</h1><a class="next" href="/dup-page-4">next</a></body></html>');
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
