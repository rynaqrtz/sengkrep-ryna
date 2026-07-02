<div align="center">

<a href="https://i.postimg.cc/0jSV8SX3/sengkrep-ryna.webp">
  <img src="https://i.postimg.cc/0jSV8SX3/sengkrep-ryna.webp" alt="sengkrep-ryna" width="100%" />
</a>

<br /><br />

<h1>sengkrep-ryna</h1>

<p><strong>Production-grade reliability layer for Node.js scraping.</strong><br />
Not an HTTP client. Not an HTML parser. Not a framework.<br />
The middleware that keeps your scrapers <em>resilient</em>.</p>

[![npm version](https://img.shields.io/npm/v/sengkrep-ryna?color=black&style=flat-square)](https://www.npmjs.com/package/sengkrep-ryna)
[![license](https://img.shields.io/npm/l/sengkrep-ryna?color=black&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-black?style=flat-square)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-1-black?style=flat-square)](./package.json)
[![tests](https://img.shields.io/badge/tests-189%20passing-black?style=flat-square)](./test)

</div>

---

## v3.1.0 — Fundamentals + AIO Update

This release focuses on fixing core fundamentals (`fetch()`, `load()`, fallback selectors, accurate documentation) before adding new features. If you've tried previous versions and ran into "method not found" or "selector not flexible enough" issues — they're addressed here.

**Fixes based on user feedback:**

| Issue | Fix |
|---|---|
| No way to get raw HTML without schema | `scraper.fetch(url)` — returns `{status, headers, body}` raw |
| Had to install cheerio separately despite being a dependency | `scraper.load(html)` and `sengkrep.cheerio` exported directly |
| Selector fails when site structure changes slightly | `selector` now accepts arrays — tries each until one matches |
| Pagination stops mid-way | `nextSelector: 'auto'` + total page detection from `.page-numbers` widget |
| Error messages unclear about which field/selector failed | Errors now include field, attempted selectors, and status code |
| Cache enabled without being noticed | Confirmed: cache is **OFF by default**, must be explicitly set |

**New in v3.1:** HTTP/2 (multiplexing), DNS cache, keep-alive connection pool, binary-safe response handling (auto-detect images/files, no more text corruption), auto charset detection (Shift-JIS, GBK, etc. — not just UTF-8), stream-to-file for responses >10MB, JSON-LD & Microdata extractor, encoding utilities (base64/hex/unicode/HTML entity/XOR/Caesar), form auto-submit, progress bar, CSV/JSONL streaming writer, and CLI tool.

**Why no TLS fingerprint spoofing / CAPTCHA solver?** Because their sole purpose is to defeat security controls that sites intentionally put in place. `sengkrep-ryna` focuses on reliability & compatibility, not bypassing third-party protections.

---

## Positioning

| Library | Best at |
|---|---|
| axios | HTTP client |
| cheerio | HTML parser |
| puppeteer/playwright | Browser automation |
| crawlee | Scraping framework |
| **sengkrep-ryna** | **Reliability layer** — middleware that keeps scrapers from breaking |

`sengkrep-ryna` has its own HTTP client and HTML parser (so it can be used standalone), but its core value lies in the layers above: health monitor, diff detector, circuit breaker, smart retry, proxy rotation — the things that keep your scraper running next week, not just today.

---

## Why sengkrep-ryna?

Real-world problems it solves:

- Selectors change silently after site deployments — no one gets alerted
- Binary responses (images/fonts/failed decompression) get treated as text and become garbled garbage
- Sites use non-UTF-8 encodings (Shift-JIS, GBK) — results become mojibake
- Rate limit hits, scraper dies, retry hammers the server even faster
- Single domain goes down completely but scraper keeps retrying every request
- Need to login before accessing data — CSRF token expires constantly
- Process dies mid-crawl across millions of URLs — must restart from zero
- Data you need lives in internal JSON API (XHR), not HTML

`sengkrep-ryna` is the layer you **wrap** around your existing scraper, or use directly as a full-featured scraper.

---

## Installation

```bash
npm install sengkrep-ryna
```

The only external dependency: cheerio. All other features (HTTP/2, proxy tunneling, cookie jar, cache, DNS cache, etc.) are built on Node.js native modules — requires Node.js 18+.

---

Quick Start — 3 Core Actions

```js
const sengkrep = require('sengkrep-ryna');

const res = await sengkrep.fetch('https://example.com');
console.log(res.status, res.body);

const $ = sengkrep.load(res.body);
console.log($('h1').text());

const data = await sengkrep.extract('https://books.toscrape.com', {
  title: 'h1',
  price: '.price_color',
});
console.log(data);
```

All three are consistent across all API levels — fetch() for raw HTTP, load() for manual parsing, extract() for schema-based scraping.

---

CLI

```bash
npx sengkrep-ryna fetch https://example.com

npx sengkrep-ryna scrape https://books.toscrape.com \
  --schema '{"title":"h1","price":".price_color"}' \
  --format csv --output books.csv \
  --pages 5 --next auto
```

Run sengkrep-ryna help for all options.

---

Table of Contents

· Core API
· Schema Syntax
· Reliability — Retry, Circuit Breaker, Health Monitor, Diff Detector, Incremental
· Identity & Access — Fingerprint, Cookies, CSRF, Auth/JWT, Proxy, Session Pool
· Performance — Cache, HTTP/2, DNS Cache, Keep-Alive, Rate Limiter, Streaming
· Data Extraction — JSON-LD/Microdata, Encoding Utils, Content Safety, Scripts, GraphQL, WordPress
· Ops & Tooling — Observability, HAR, Webhooks, Plugins, Progress Bar
· Configuration Reference
· Error Handling
· Testing
· Examples
· Architecture
· Tips & Troubleshooting
· License

---

Core API

sengkrep.fetch(url, options) / scraper.fetch(url, options)

Raw HTTP request. No parsing, no schema.

```js
const res = await sengkrep.fetch('https://example.com/page');
res.status;
res.headers;
res.body;
res.binary;
res.streamed;
```

sengkrep.load(html) / scraper.load(html)

Direct wrapper around cheerio.load(). No need to install cheerio separately.

```js
const $ = sengkrep.load(res.body);
$('.product').each((i, el) => console.log($(el).text()));
```

Cheerio is also exported directly: const { cheerio } = require('sengkrep-ryna').

sengkrep.extract(url, schema, options) / scraper.extract(...)

Fetch + parse in one call based on a schema. Auto-detects HTML vs JSON vs RSS/Atom vs CSV.

```js
const data = await sengkrep.extract('https://example.com/product', {
  name:  'h1.product-title',
  price: '.price-tag',
});
```

Options:

Key Type Default Description
strict boolean false Throw if validation fails
responseType 'auto'\|'html'\|'json'\|'rss'\|'csv' 'auto' Force parsing mode
params object — Query params, merged into URL
allowBinary boolean false Allow returning binary metadata (instead of throwing)
allowStreamed boolean false Allow returning streamed-to-disk metadata
request.headers object {} Additional headers
request.signal AbortSignal — For cancelling requests

scraper.batch(urls, schema, options)

```js
const results = await scraper.batch(urls, schema, {
  concurrency: 3,
  delay: 800,
  randomOrder: true,
  progressBar: true,
  onProgress: (done, total) => {},
});
```

randomOrder shuffles URL order (more natural load distribution). progressBar enables built-in terminal progress bar.

scraper.stream(urls, schema, options)

Async generator — process large datasets without waiting for all to finish.

```js
for await (const { url, data, error } of scraper.stream(urls, schema, { concurrency: 5 })) {
  if (!error) console.log(url, data);
}
```

scraper.paginate(startUrl, config, schema, options)

```js
const items = await scraper.paginate(
  'https://books.toscrape.com/catalogue/page-1.html',
  { nextSelector: 'auto', itemsSelector: '.product_pod', maxPages: 10 },
  { title: 'h3 a', price: '.price_color' },
);
```

nextSelector: 'auto' uses heuristic detection (rel="next", "Next"/"»" text, .pagination-next class, or URL number increment) — no need to know the site structure beforehand. It also reads .page-numbers/.pagination widgets to estimate total pages and logs it.

scraper.crawl(options)

Resumable BFS crawler with state persistence.

```js
const job = scraper.crawl({
  seed:    'https://example.com',
  schema:  { title: 'h1' },
  follow:  /\/article\//,
  maxUrls: 5000,
  concurrency: 5,
  stateFile: './crawl-state.json',
});

job.on('url:done', ({ url, data }) => console.log(url));
job.on('progress', ({ done, queued }) => console.log(`${done} done, ${queued} queued`));

await job.start();

await job.resume();
```

If the process dies (crash, ctrl+c), state (visited URLs + queue + results) is saved to stateFile. Create a new instance with the same config and call .resume().

scraper.login(url, formData, options)

POST to login page, auto-harvests CSRF token from meta tags/hidden inputs/cookies, session cookie is automatically used in subsequent requests.

```js
const ok = await scraper.login('https://example.com/login', { username: 'x', password: 'y' });
```

scraper.submitForm(url, formSelector, overrides)

Generalization of login() — parses any form (not just login) and submits with overridden fields.

```js
const res = await scraper.submitForm('https://example.com/search', 'form#search', { q: 'laptop' });
```

scraper.discover(origin, options)

Find URLs via robots.txt → sitemap.xml (including nested sitemap indexes).

```js
const urls = await scraper.discover('https://example.com', { pattern: /\/product\// });
```

scraper.export(input, schema, options)

Scrape + serialize to file in one call. input can be a single URL, array of URLs, or already-extracted data.

```js
await scraper.export(urls, schema, { format: 'csv', path: './output/products.csv' });
```

---

Schema Syntax

HTML — with Fallback Selectors

```js
const schema = {
  title: 'h1',

  tags: ['.tag'],

  price: {
    selector: ['.price-v2', '.price-v1', '.price'],
    required: true,
    pattern:  /^[£$€Rp][\d,.]+$/,
  },

  description: {
    selector:  '.desc',
    type:      'html',
    transform: (val) => val.trim(),
    default:   '',
  },
};
```

selector can be an array — tried one by one, first match wins. Useful for sites where class names change per deploy (CSS-in-JS hashes, A/B testing, etc.). Health report (data._ryna.health) records which selector actually matched.

Field options: selector (string/array), required, multiple, attr, type ('text'\|'html'), transform, pattern, default.

JSON — Path Notation, Also with Fallbacks

```js
const schema = {
  title: { path: ['data.name', 'data.title', 'title'] },
  items: 'data.items[].name',
};

const data = await scraper.extract(apiUrl, schema, { responseType: 'json' });
```

a.b[].c = wildcard (maps to all array elements). a.b[0].c = specific index.

---

Reliability

Retry

Adaptive backoff per status code + jitter. 429/403 wait longer than 500/502. Requests cancelled via AbortSignal are never retried.

```js
scraper.create({ retry: { max: 3, retryOn: [408, 429, 500, 502, 503, 504] } });
```

Circuit Breaker

Stops hammering domains that are clearly down, instead of retrying endlessly.

```js
scraper.create({
  circuitBreaker: { threshold: 5, cooldown: 60000, onOpen: ({ key }) => console.log(`${key} circuit open`) },
});
```

CLOSED → (consecutive failures) → OPEN (all requests immediately rejected) → (after cooldown) → HALF_OPEN (one test request) → back to CLOSED if successful, OPEN if it fails.

Health Monitor

Tracks empty-rate and count-drop per selector in a sliding window.

```js
scraper.create({ health: { alertThreshold: 0.5, onAlert: ({ alerts }) => {} } });
```

Diff Detector

Snapshots per run, compares structure, alerts on changes (keys_removed, count_changed, etc.).

```js
scraper.create({ diff: { onDiff: ({ hasCritical, changes }) => {} } });
```

Incremental (ETag / Last-Modified)

Skip re-extraction if the server says content hasn't changed (304 Not Modified) — saves bandwidth and time.

```js
scraper.create({ incremental: true });
```

---

Identity & Access

Fingerprint

UA rotation, randomized header order, timing jitter, Sec-Fetch-* headers consistent with request context (not hardcoded).

```js
scraper.create({ fingerprint: { userAgent: 'random', rotateUAOnEachRequest: true } });
```

Cookies

Enabled by default (cookies: true). Auto-captures from Set-Cookie, auto-replays to the same domain including subdomains.

CSRF Handler

Automatically used in login()/submitForm() — extracts token from meta tags/hidden inputs/cookies, sends as form field + header. For sessions you actually have access to (your own accounts, your own sites).

Auth Manager (JWT/Bearer auto-refresh)

```js
scraper.create({
  auth: {
    token: initialToken,
    refresh: async (oldToken) => (await getNewToken(oldToken)),
    refreshOn: [401],
  },
});
```

Detects 401, refreshes once, retries automatically. Concurrent requests don't trigger multiple refreshes (deduped).

Proxy Rotation

CONNECT tunnel native (HTTPS) and forward proxy (HTTP) — no additional dependencies needed.

```js
scraper.create({ proxies: ['http://user:pass@proxy1:8080', 'http://proxy2:8080'], proxyStrategy: 'sticky' });
```

round-robin / random / sticky (same domain = same proxy). Proxies that fail consecutively are automatically skipped.

Session Pool

Multi-session (multi-account/API key) with independent cookie jars and fingerprints per session.

```js
const pool = scraper.sessionPool; // or: scraper.create({ sessionPool: { size: 5, strategy: 'least-used' } });
```

---

Performance

Cache

TTL-based, OFF by default. Skips network if still fresh, but extraction/health/diff/validation still run every call (metadata stays accurate).

```js
scraper.create({ cache: { ttl: 3600, storage: 'memory' } });
```

HTTP/2

Multiplexes multiple requests over a single connection. Auto-falls back if server doesn't support it.

```js
const scraper = scraper.create({ http2: true });
```

DNS Cache

Caches DNS resolution results with TTL, round-robin if hostname has multiple IPs.

```js
scraper.create({ dns: { ttl: 300000 } });
```

Keep-Alive Pool

Enabled by default — TCP connections are reused for requests to the same host, faster and more considerate to target servers.

Rate Limiter

```js
scraper.create({ rateLimit: { requestsPerSecond: 2, concurrency: 3 } });
```

Stream-to-file

Large responses (default >10MB) are automatically streamed to a temp file instead of being fully buffered in memory.

```js
const res = await scraper.fetch(bigFileUrl);
if (res.streamed) console.log('Saved to', res.filePath);
```

Streaming Writer (CSV/JSONL)

```js
const { StreamWriter } = require('sengkrep-ryna');
const writer = new StreamWriter('./output/data.csv', { format: 'csv' });
for (const item of hugeList) writer.write(item);
await writer.close();
```

---

Data Extraction

JSON-LD & Microdata

Formats that sites intentionally expose for SEO rich snippets — the most reliable for scraping.

```js
const products = await scraper.extractJsonLd(url);
const people    = await scraper.extractMicrodata(url);
const cards     = await scraper.extractDataAttributes(url, '[data-product-id]');
```

Content Safety (charset & binary)

Automatically runs on every fetch()/extract() — no setup needed.

· Auto charset detection: BOM → Content-Type header → <meta charset> → fallback UTF-8. Supports Shift-JIS, GBK, EUC-JP, Windows-1252, etc. (native via ICU, no iconv-lite dependency).
· Binary detection: magic-byte sniffing (PNG, JPEG, PDF, ZIP, GZIP, WOFF, etc.) + null-byte heuristic. Binary responses won't be corrupted into text — extract() throws a clear error (BINARY_RESPONSE) unless you pass allowBinary: true.

```js
try {
  await scraper.extract(url, schema);
} catch (err) {
  if (err.code === 'BINARY_RESPONSE') {
    console.log('This is a', err.meta.sniffedType, 'file, not HTML/JSON');
  }
}
```

Encoding Utilities

```js
const {
  decodeHtmlEntities, decodeUnicodeEscapes,
  decodeBase64, decodeHex, detectAndDecode,
  xorDecode, caesarDecode, rot13, parseJSONP,
} = require('sengkrep-ryna');

decodeHtmlEntities('Tom &amp; Jerry');
detectAndDecode(someString);
parseJSONP('callback({"ok":true})');
```

Script Extractor

```js
const scripts = await scraper.extractScripts(url);
const { extractSourceMapUrl, beautifyJs } = require('sengkrep-ryna');
```

Extracts and beautifies script tags — not a security deobfuscator.

GraphQL Client

```js
const schema = await scraper.graphql.introspect(endpoint);
const data   = await scraper.graphql.query(endpoint, queryString, variables);
const items  = await scraper.graphql.queryAllPages(endpoint, queryString, { connectionPath: 'products' });
```

WordPress Helper

Public REST API (/wp-json/) and admin-ajax.php with nonce handling.

```js
const { data } = await scraper.wordpress.restApi(origin, 'wp/v2/posts');
const all       = await scraper.wordpress.restApiAll(origin, 'wp/v2/posts', { per_page: 100 });
const result    = await scraper.wordpress.ajaxAction(origin, 'load_more_posts', {}, { nonceFromPage: '/blog' });
```

---

Ops & Tooling

Observability Dashboard

```js
scraper.create({ observability: { enabled: true, port: 3001 } });
```

Open http://localhost:3001 for live stats. Or pull manually:

```js
const report = scraper.getObservabilityReport();
report.successRate;
report.categories;
report.bytes;
report.topErrors;
```

Error categories auto-classified: network, timeout, http4xx, http5xx, validation, security, circuit.

HAR Export

```js
const scraper = sengkrep.create({ har: true });
await scraper.extract(url, schema);
scraper.saveHar('./debug.har');
```

Open .har file in Chrome DevTools (Network tab → import).

Webhooks

```js
scraper.create({ webhook: { onComplete: 'https://your-api.com/done', onError: 'https://your-api.com/error' } });
```

Plugin System

```js
const { plugins } = require('sengkrep-ryna');

scraper.plugins.use(plugins.timestamp());
scraper.plugins.use(plugins.logToFile('./scrape.log'));

scraper.plugins.use({
  beforeRequest: ({ url, options }) => ({ url, options }),
  afterExtract:  ({ data, meta })   => { data.custom = true; return { data, meta }; },
});
```

Progress Bar

```js
await scraper.batch(urls, schema, { progressBar: true });
```

---

Configuration Reference

```js
const scraper = sengkrep.create({
  logLevel: 'info', logPretty: true, baseURL: null,
  timeout: 30000, maxRedirects: 5, keepAlive: true,
  delay: 1000, delayMin: 600, delayMax: 3000,
  maxMemoryBuffer: 10 * 1024 * 1024,

  responseType: 'auto', cookies: true, http2: false,

  fingerprint: { userAgent: 'random', rotateUAOnEachRequest: true, randomizeHeaderOrder: true, randomizeTiming: true },
  retry: { max: 3, jitter: true, retryOn: [408, 429, 500, 502, 503, 504, 403] },
  health: { alertThreshold: 0.5, windowSize: 10, onAlert: null },
  diff: { storageDir: '.sengkrep-ryna', sensitivity: 'structural', onDiff: null },
  cache: false,
  circuitBreaker: false,
  incremental: false,
  rateLimit: { requestsPerSecond: null, concurrency: null },
  proxies: [], proxyStrategy: 'round-robin', proxyMaxFailures: 3,
  dns: false,
  sessionPool: false,
  security: { blockPrivateIPs: false, allowDomains: null, blockDomains: [] },
  auth: { token: null, refresh: null, refreshOn: [401] },
  csrf: { auto: true },
  observability: { enabled: false, port: null },
  webhook: { onStart: null, onComplete: null, onError: null, onProgress: null },
  har: false,
  validate: {},
});
```

---

Error Handling

```js
const { errors } = require('sengkrep-ryna');

try {
  await scraper.extract(url, schema, { strict: true });
} catch (err) {
  switch (err.code) {
    case 'HTTP_ERROR':        console.log('status', err.status); break;
    case 'TIMEOUT':            break;
    case 'CANCELED':           break;
    case 'NETWORK_ERROR':      break;
    case 'PROXY_ERROR':        break;
    case 'SECURITY_BLOCKED':   break;
    case 'CIRCUIT_OPEN':       console.log('retry after', err.retryAt); break;
    case 'BINARY_RESPONSE':    console.log('type', err.meta.sniffedType); break;
  }
  if (err.name === 'ValidationError') err.errors.forEach(e => console.log(e.field, e.message));
  if (err.name === 'ExtractionError') console.log(err.field, err.selector);
}
```

---

Testing

189 tests, 100% local — no internet required. Works in Termux/CI/offline.

```bash
npm test
```

---

Examples

Fundamentals — fetch, load, extract together

```js
const sengkrep = require('sengkrep-ryna');

const res = await sengkrep.fetch('https://example.com/product/1');
const $   = sengkrep.load(res.body);

if ($('.out-of-stock').length > 0) {
  console.log('Out of stock, skip');
} else {
  const data = await sengkrep.extract('https://example.com/product/1', {
    name:  { selector: ['h1.name', 'h1'] },
    price: { selector: ['.price-v2', '.price'], required: true },
  });
  console.log(data);
}
```

Full reliability with fallback selectors

```js
const scraper = sengkrep.create({
  retry: { max: 3 },
  circuitBreaker: { threshold: 5 },
  health: { onAlert: ({ alerts }) => alerts.forEach(a => console.error(a.message)) },
  diff:   { onDiff: ({ hasCritical }) => { if (hasCritical) console.error('Structure changed!'); } },
});

const product = await scraper.extract(url, {
  name:  { selector: ['h1.product-title', 'h1', '.title'], required: true },
  price: { selector: ['.price-now', '.price'], pattern: /^[Rp$£][\d.,]+$/ },
});
```

Resumable crawl of millions of pages

```js
const scraper = sengkrep.create({ rateLimit: { requestsPerSecond: 3 }, cache: { ttl: 3600 } });

const job = scraper.crawl({
  seed: 'https://example-blog.com',
  schema: { title: 'h1', content: { selector: '.post-content', type: 'html' } },
  follow: /\/post\//,
  maxUrls: 100000,
  stateFile: './blog-crawl.json',
});

job.on('progress', ({ done, queued }) => process.stdout.write(`\r${done} done, ${queued} queued`));

await job.start();
```

If this process dies mid-way, run the same script again and call job.resume() — resumes from where it left off, not from zero.

Login-walled site with sessions

```js
const scraper = sengkrep.create({ cookies: true });

const ok = await scraper.login('https://example.com/login', {
  username: 'qrtz',
  password: process.env.SCRAPE_PASSWORD,
});

if (ok) {
  const orders = await scraper.paginate(
    'https://example.com/account/orders',
    { nextSelector: 'auto', itemsSelector: '.order-row', maxPages: 50 },
    { id: '.order-id', total: '.order-total' },
  );
}
```

Internal JSON API (not HTML)

```js
const data = await scraper.extract('https://example.com/api/v2/products?page=1', {
  products: { path: ['data.products[].name', 'products[].name'] },
  total:    'meta.total_count',
}, { responseType: 'json' });
```

Structured data (JSON-LD) — most reliable for e-commerce

```js
const products = await scraper.extractJsonLd('https://shop.example.com/product/1');
console.log(products[0].name, products[0].offers?.price);
```

---

Architecture

```
sengkrep-ryna/
├── index.js                 Entry point + convenience API
├── bin/sengkrep-ryna.js      CLI
├── test/                     189 tests, zero external network
└── src/
    ├── Ryna.js                Main orchestrator
    ├── core/
    │   ├── Fetcher.js          HTTP/1.1 client — keep-alive, streaming decompress,
    │   │                       binary detection, stream-to-file, proxy, cookies
    │   ├── Http2Fetcher.js     HTTP/2 client — session pool per origin, multiplexing
    │   ├── ProxyTunnel.js      CONNECT tunnel native
    │   ├── Extractor.js        HTML extraction — fallback selector chains
    │   ├── JsonExtractor.js    JSON path extraction — fallback path chains
    │   └── Retry.js            Adaptive per-status backoff
    └── modules/                27 modules: Fingerprint, SchemaValidator, HealthMonitor,
    │                           DiffDetector, Cache, CookieJar, ProxyRotator, RateLimiter,
    │                           Interceptors, Discover, SecurityGuard, CircuitBreaker,
    │                           Incremental, CsrfHandler, AuthManager, SessionPool,
    │                           PluginSystem, CrawlQueue, Observability, HarRecorder,
    │                           WordPress, GraphQLClient, DnsCache, FormHandler,
    │                           ProgressBar, PaginationDetector, Webhook
    └── utils/                  logger, storage, exporter, contentHandlers (RSS/CSV),
                                microdata (JSON-LD), scriptExtractor, urlUtils,
                                streamWriter, contentSafety (charset/binary), encodingUtils
```

Request flow:

```
scraper.extract(url, schema)
  └── plugins.run('beforeRequest')
  └── SecurityGuard.check()          (SSRF guard, opt-in)
  └── CircuitBreaker.assertCanRequest()
  └── Cache.get() → HIT? return cached
  └── Retry.run()
      └── RateLimiter.acquire() / ProxyRotator.next()
      └── Fetcher / Http2Fetcher
          └── Interceptors.request.run()
          └── Fingerprint.buildHeaders()  +  CookieJar  +  AuthManager
          └── DnsCache.lookup()  (opt-in)
          └── decompress (gzip/br/deflate/zstd) as stream
          └── contentSafety.inspect()  →  binary? stream-to-file? charset decode
          └── Interceptors.response.run()
      └── on 401: AuthManager.refresh() → retry once
  └── Extractor / JsonExtractor / RSS / CSV  (responseType auto-detect)
  └── HealthMonitor.record()  +  DiffDetector.check()  +  SchemaValidator.validate()
  └── plugins.run('afterExtract')
  └── Observability.recordSuccess/Failure()
  └── return { ...data, _ryna: { health, diff, validation, cache, responseType } }
```

---

Tips & Troubleshooting

Getting garbled/binary garbage from scrape — likely the response wasn't decompressed (gzip/br/zstd that failed), or it's actually a binary file (image/font) being incorrectly treated as text. extract() now auto-detects this and throws a clear BINARY_RESPONSE error with what it actually is (via magic-byte sniffing), instead of returning corrupted strings. If you need raw bytes, pass { allowBinary: true }.

Scraped text looks like mojibake — site likely uses non-UTF-8 charset (Shift-JIS, GBK, etc.). This is now auto-handled via BOM/header/meta-tag detection. If still broken, check data._ryna — though charset field isn't yet exposed for plain text, scraper.fetch() returns res.charset for manual debugging.

Selector returns null despite data existing in browser — site is likely client-side rendered (JavaScript), and sengkrep-ryna only parses raw HTML. Check view-source: in browser; if data isn't there, find the internal JSON endpoint via DevTools Network tab and use responseType: 'json'.

Pagination stops before the last page — try nextSelector: 'auto', the detector handles common patterns (rel="next", "Next" text, .pagination-next class, and URL numbers). If the site uses a very custom pattern, you'll still need an explicit selector.

Proxy auth keeps failing — supported format: http://user:pass@host:port. Encode special characters in password (@, :, /) with encodeURIComponent.

---

License

MIT © qrtz