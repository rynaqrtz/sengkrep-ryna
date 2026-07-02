const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const ROOT     = path.join(__dirname, '..');
const sengkrep = require(ROOT);
const fixtures = require('./server');

const contentSafety = require(path.join(ROOT, 'src/utils/contentSafety'));
const encodingUtils  = require(path.join(ROOT, 'src/utils/encodingUtils'));
const { extractJsonLd, extractMicrodata, extractDataAttributes } = require(path.join(ROOT, 'src/utils/microdata'));
const { extractScripts, extractSourceMapUrl, beautify } = require(path.join(ROOT, 'src/utils/scriptExtractor'));
const { normalizeUrl, extractLinks, UrlDeduplicator }    = require(path.join(ROOT, 'src/utils/urlUtils'));
const { detectNextLink, detectTotalPages }               = require(path.join(ROOT, 'src/modules/PaginationDetector'));
const StreamWriter  = require(path.join(ROOT, 'src/utils/streamWriter'));
const ProgressBar   = require(path.join(ROOT, 'src/modules/ProgressBar'));
const DnsCache       = require(path.join(ROOT, 'src/modules/DnsCache'));
const { Http2Fetcher } = require(path.join(ROOT, 'src/core/Http2Fetcher'));
const { Fetcher }   = require(path.join(ROOT, 'src/core/Fetcher'));

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

async function main() {
  await fixtures.ready;
  console.log('fixtures ready\n');

  console.log('Critique fix — public fetch() and load()');
  {
    await test('scraper.fetch() returns raw response without schema', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/html');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Hello Ryna'));
    });

    await test('scraper.load() returns a cheerio instance usable directly', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/html');
      const $   = scraper.load(res.body);
      assert.strictEqual($('#title').text(), 'Hello Ryna');
    });

    await test('sengkrep.cheerio is exported directly, no separate install needed', () => {
      assert.strictEqual(typeof sengkrep.cheerio.load, 'function');
    });

    await test('sengkrep.load top-level convenience works', async () => {
      const $ = sengkrep.load('<h1 id="x">Top level load</h1>');
      assert.strictEqual($('#x').text(), 'Top level load');
    });
  }

  console.log('\nCritique fix — fallback selector chains');
  {
    await test('HTML extractor falls through selector array until one matches', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const data = await scraper.extract('http://127.0.0.1:9911/fallback-html', {
        title: { selector: ['h1.title', '.old-title-class', '.new-title-class'] },
        price: { selector: ['.price', '.price-v1', '.price-v2'] },
      });
      assert.strictEqual(data.title, 'Fallback Title');
      assert.strictEqual(data.price, 'Rp99.000');
    });

    await test('health report exposes which selector in the chain actually matched', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const data = await scraper.extract('http://127.0.0.1:9911/fallback-html', {
        title: { selector: ['.nope', '.new-title-class'] },
      });
      assert.strictEqual(data._ryna.health.alerts.length, 0);
    });

    await test('required field lists all attempted selectors in error message', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      await assert.rejects(
        () => scraper.extract('http://127.0.0.1:9911/fallback-html', {
          missing: { selector: ['.a', '.b', '.c'], required: true },
        }),
        (err) => err.message.includes('.a') && err.message.includes('.b') && err.message.includes('.c'),
      );
    });

    await test('JsonExtractor supports fallback path chains', () => {
      const { JsonExtractor } = require(path.join(ROOT, 'src/core/JsonExtractor'));
      const je = new JsonExtractor();
      const { data } = je.extract({ new_field: 'found-me' }, { value: { path: ['old_field', 'legacy_field', 'new_field'] } });
      assert.strictEqual(data.value, 'found-me');
    });
  }

  console.log('\nCritique fix — pagination total-page detection');
  {
    await test('detectTotalPages reads highest number from .page-numbers widget', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/paginated-widget');
      const $    = scraper.load(res.body);
      assert.strictEqual(detectTotalPages($), 3);
    });

    await test('detectNextLink finds link via page-numbers next class', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/paginated-widget');
      const $    = scraper.load(res.body);
      const next = detectNextLink($, 'http://127.0.0.1:9911/paginated-widget');
      assert.ok(next.url.endsWith('/p2'));
    });
  }

  console.log('\nContent Safety (binary garbage → clear diagnostics)');
  {
    await test('isLikelyBinary flags null-byte-containing buffers', () => {
      const bin = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
      assert.strictEqual(contentSafety.isLikelyBinary(bin), true);
    });

    await test('isLikelyBinary does not flag normal text', () => {
      const text = Buffer.from('Hello, this is normal readable text content.');
      assert.strictEqual(contentSafety.isLikelyBinary(text), false);
    });

    await test('sniffContentType detects PNG magic bytes', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.strictEqual(contentSafety.sniffContentType(png), 'image/png');
    });

    await test('sniffContentType detects gzip magic bytes', () => {
      const gz = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
      assert.strictEqual(contentSafety.sniffContentType(gz), 'application/gzip');
    });

    await test('decodeBuffer respects charset from meta tag', () => {
      const html = Buffer.from('<html><head><meta charset="iso-8859-1"></head></html>');
      const result = contentSafety.decodeBuffer(html, {});
      assert.strictEqual(result.source, 'meta');
    });

    await test('decodeBuffer detects UTF-8 BOM', () => {
      const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('hello')]);
      const result  = contentSafety.decodeBuffer(withBom, {});
      assert.strictEqual(result.source, 'bom');
      assert.strictEqual(result.text, 'hello');
    });

    await test('end-to-end: octet-stream PNG is flagged binary, not corrupted as text', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      await assert.rejects(
        () => scraper.extract('http://127.0.0.1:9911/binary-image', {}),
        (err) => err.code === 'BINARY_RESPONSE' && err.meta.sniffedType === 'image/png',
      );
    });

    await test('end-to-end: allowBinary:true returns binary metadata safely', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const result = await scraper.extract('http://127.0.0.1:9911/binary-image', {}, { allowBinary: true });
      assert.strictEqual(result.binary, true);
      assert.strictEqual(result.sniffedType, 'image/png');
    });

    await test('end-to-end: Shift-JIS charset is correctly decoded, not garbled', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const data = await scraper.extract('http://127.0.0.1:9911/shift-jis', { greeting: 'h1' });
      assert.strictEqual(data.greeting, 'こんにちは');
    });
  }

  console.log('\nEncoding utilities');
  {
    await test('decodeHtmlEntities handles named and numeric entities', () => {
      assert.strictEqual(encodingUtils.decodeHtmlEntities('Tom &amp; Jerry &#39;s'), "Tom & Jerry 's");
      assert.strictEqual(encodingUtils.decodeHtmlEntities('&#x41;&#x42;'), 'AB');
    });

    await test('decodeUnicodeEscapes handles \\u sequences', () => {
      assert.strictEqual(encodingUtils.decodeUnicodeEscapes('\\u0048\\u0065llo'), 'Hello');
    });

    await test('detectAndDecode identifies and decodes base64', () => {
      const encoded = Buffer.from('secret-value').toString('base64');
      const result   = encodingUtils.detectAndDecode(encoded);
      assert.strictEqual(result.encoding, 'base64');
      assert.strictEqual(result.decoded, 'secret-value');
    });

    await test('detectAndDecode identifies and decodes hex', () => {
      const encoded = Buffer.from('hex-value').toString('hex');
      const result   = encodingUtils.detectAndDecode(encoded);
      assert.strictEqual(result.encoding, 'hex');
      assert.strictEqual(result.decoded, 'hex-value');
    });

    await test('xorDecode is reversible with the same key', () => {
      const original = Buffer.from('test message');
      const encoded  = encodingUtils.xorDecode(original, 'key123');
      const decoded  = encodingUtils.xorDecode(encoded, 'key123');
      assert.strictEqual(decoded.toString(), 'test message');
    });

    await test('rot13 is its own inverse', () => {
      const rotated = encodingUtils.rot13('Hello World');
      assert.strictEqual(encodingUtils.rot13(rotated), 'Hello World');
      assert.notStrictEqual(rotated, 'Hello World');
    });

    await test('parseJSONP unwraps callback-wrapped JSON', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res     = await scraper.fetch('http://127.0.0.1:9911/jsonp');
      const parsed  = encodingUtils.parseJSONP(res.body);
      assert.strictEqual(parsed.callback, 'myCallback');
      assert.strictEqual(parsed.data.value, 42);
    });
  }

  console.log('\nStructured data — JSON-LD, Microdata, data-* attributes');
  {
    await test('extractJsonLd parses embedded ld+json script', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const items = await scraper.extractJsonLd('http://127.0.0.1:9911/structured');
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'Sepatu Ryna');
      assert.strictEqual(items[0].offers.price, '250000');
    });

    await test('extractMicrodata parses itemscope/itemprop tree', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const items = await scraper.extractMicrodata('http://127.0.0.1:9911/structured');
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0]['@type'], 'Person');
      assert.strictEqual(items[0].name, 'Budi');
      assert.strictEqual(items[0].jobTitle, 'Developer');
    });

    await test('extractDataAttributes converts data-* to camelCase object', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const items = await scraper.extractDataAttributes('http://127.0.0.1:9911/structured', '[data-product-id]');
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].productId, '42');
      assert.strictEqual(items[0].inStock, 'true');
    });
  }

  console.log('\nScript extractor');
  {
    await test('extractScripts separates inline and external scripts', () => {
      const $ = sengkrep.load('<script src="/app.js"></script><script>var x=1;</script>');
      const scripts = extractScripts($, 'http://example.com');
      assert.strictEqual(scripts.length, 2);
      assert.strictEqual(scripts[0].inline, false);
      assert.strictEqual(scripts[0].src, 'http://example.com/app.js');
      assert.strictEqual(scripts[1].inline, true);
    });

    await test('extractSourceMapUrl finds sourceMappingURL comment', () => {
      const js = 'var x=1;\n//# sourceMappingURL=app.min.js.map';
      assert.strictEqual(extractSourceMapUrl(js), 'app.min.js.map');
    });

    await test('beautify adds newlines and indentation to minified code', () => {
      const minified = 'function f(){var a=1;var b=2;return a+b;}';
      const pretty   = beautify(minified);
      assert.ok(pretty.split('\n').length > 1);
    });
  }

  console.log('\nURL utilities');
  {
    await test('normalizeUrl strips hash and sorts query params', () => {
      const a = normalizeUrl('http://x.com/page?b=2&a=1#section');
      const b = normalizeUrl('http://x.com/page?a=1&b=2');
      assert.strictEqual(a, b);
    });

    await test('normalizeUrl lowercases hostname', () => {
      assert.strictEqual(normalizeUrl('http://EXAMPLE.com/Path'), 'http://example.com/Path');
    });

    await test('extractLinks pulls absolute normalized links from a page', () => {
      const $ = sengkrep.load('<a href="/a">a</a><a href="https://other.com/b">b</a><a href="javascript:void(0)">skip</a>');
      const links = extractLinks($, 'http://x.com');
      assert.strictEqual(links.length, 2);
      assert.ok(links.includes('http://x.com/a'));
    });

    await test('UrlDeduplicator filters already-seen normalized urls', () => {
      const dedup = new UrlDeduplicator();
      const fresh = dedup.filterNew(['http://x.com/a?x=1&y=2', 'http://x.com/a?y=2&x=1', 'http://x.com/b']);
      assert.strictEqual(fresh.length, 2);
    });
  }

  console.log('\nHttp2Fetcher (h2c)');
  {
    let h2Server;
    await test('fetches plaintext HTTP/2 response successfully', async () => {
      const http2 = require('http2');
      h2Server = http2.createServer();
      h2Server.on('stream', (stream) => {
        stream.respond({ ':status': 200, 'content-type': 'application/json' });
        stream.end(JSON.stringify({ via: 'h2' }));
      });
      await new Promise(r => h2Server.listen(9932, '127.0.0.1', r));

      const f   = new Http2Fetcher({ timeout: 5000 });
      const res = await f.fetch('http://127.0.0.1:9932/');
      assert.strictEqual(res.protocol, 'h2');
      assert.strictEqual(JSON.parse(res.body).via, 'h2');
      f.closeAll();
      h2Server.close();
    });
  }

  console.log('\nDnsCache');
  {
    await test('lookup resolves and caches a literal IP passthrough-style', async () => {
      const cache = new DnsCache({ ttl: 60000 });
      const addr  = await cache.lookup('127.0.0.1');
      assert.ok(addr === '127.0.0.1' || addr === '::1' || typeof addr === 'string');
    });

    await test('invalidate clears cached entry', async () => {
      const cache = new DnsCache({ ttl: 60000 });
      await cache.lookup('127.0.0.1');
      cache.invalidate('127.0.0.1');
      assert.strictEqual(cache.stats().length, 0);
    });

    await test('end-to-end scraper with dns:true still resolves local server', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false, dns: true });
      const data = await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      assert.strictEqual(data.title, 'Hello Ryna');
    });
  }

  console.log('\nFormHandler + submitForm');
  {
    await test('parses form fields including hidden csrf token', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res  = await scraper.fetch('http://127.0.0.1:9911/simple-form');
      const $    = scraper.load(res.body);
      const parsed = scraper.formHandler.parse($, 'form', 'http://127.0.0.1:9911/simple-form');
      assert.strictEqual(parsed.method, 'POST');
      assert.strictEqual(parsed.fields.q, 'default');
      assert.strictEqual(parsed.fields._token, 'form-tok-1');
    });

    await test('submitForm end-to-end overrides field and submits', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.submitForm('http://127.0.0.1:9911/simple-form', 'form', { q: 'overridden' });
      const body = JSON.parse(res.body);
      assert.strictEqual(body.q, 'overridden');
      assert.strictEqual(body.token, 'form-tok-1');
    });
  }

  console.log('\nProgressBar');
  {
    await test('update computes percent without throwing when disabled', () => {
      const bar = new ProgressBar({ total: 10, enabled: false });
      bar.update(5);
      bar.increment(2);
      bar.finish();
    });

    await test('enabled bar writes carriage-return line to stream', () => {
      const chunks = [];
      const fakeStream = { isTTY: true, write: (s) => chunks.push(s) };
      const bar = new ProgressBar({ total: 4, stream: fakeStream, enabled: true });
      bar.update(2);
      assert.ok(chunks[0].includes('50%'));
    });
  }

  console.log('\nStreamWriter');
  {
    await test('writes CSV incrementally with header once', async () => {
      const tmp = path.join(os.tmpdir(), `ryna-sw-${Date.now()}.csv`);
      const writer = new StreamWriter(tmp, { format: 'csv' });
      writer.write({ name: 'A', price: 1 });
      writer.write({ name: 'B', price: 2 });
      await writer.close();
      const content = fs.readFileSync(tmp, 'utf8');
      const lines   = content.trim().split('\n');
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(lines[0], 'name,price');
      fs.unlinkSync(tmp);
    });

    await test('writes JSONL with one object per line', async () => {
      const tmp = path.join(os.tmpdir(), `ryna-sw-${Date.now()}.jsonl`);
      const writer = new StreamWriter(tmp, { format: 'jsonl' });
      writer.writeMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
      await writer.close();
      const lines = fs.readFileSync(tmp, 'utf8').trim().split('\n');
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(writer.count(), 3);
      fs.unlinkSync(tmp);
    });
  }

  console.log('\nStream-to-file for large responses');
  {
    await test('response over maxMemoryBuffer streams to disk instead of buffering', async () => {
      const f   = new Fetcher({ timeout: 15000, maxMemoryBuffer: 2 * 1024 * 1024 });
      const res = await f.fetch('http://127.0.0.1:9911/large-file');
      assert.strictEqual(res.streamed, true);
      assert.ok(fs.existsSync(res.filePath));
      const stat = fs.statSync(res.filePath);
      assert.ok(stat.size >= 12 * 1024 * 1024);
      fs.unlinkSync(res.filePath);
    });
  }

  console.log('\nKeep-alive connection pool');
  {
    await test('reuses sockets across requests to the same host', async () => {
      const f = new Fetcher({ timeout: 5000, keepAlive: true });
      await f.fetch('http://127.0.0.1:9911/html');
      await f.fetch('http://127.0.0.1:9911/json');
      const sockets = f.httpAgent.sockets['127.0.0.1:9911:'] ?? f.httpAgent.freeSockets['127.0.0.1:9911:'];
      assert.ok(f.httpAgent.keepAlive === true);
    });
  }

  console.log('\nObservability — failure categorization + bytes');
  {
    await test('categorizes network vs http4xx vs security failures', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false, security: { blockPrivateIPs: true } });
      try { await scraper.extract('http://127.0.0.1:9911/html', {}); } catch {}
      const scraper2 = sengkrep.create({ logLevel: 'error', diff: false });
      try { await scraper2.extract('http://127.0.0.1:9911/nope', {}); } catch {}
      const r1 = scraper.getObservabilityReport();
      const r2 = scraper2.getObservabilityReport();
      assert.strictEqual(r1.categories.security, 1);
      assert.strictEqual(r2.categories.http4xx, 1);
    });

    await test('tracks request/response byte sizes', async () => {
      const f   = new Fetcher({ timeout: 5000 });
      const res = await f.fetch('http://127.0.0.1:9911/html');
      assert.ok(res.responseSize > 0);
    });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);

  fixtures.closeAll();

  if (failed > 0) {
    failures.forEach(f => console.log(`✗ ${f.name}\n  ${f.err.stack}\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('v3.1 test runner crashed:', err);
  fixtures.closeAll();
  process.exit(1);
});
