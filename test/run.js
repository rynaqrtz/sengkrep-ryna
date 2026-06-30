const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const ROOT = path.join(__dirname, '..');

const { Fetcher, FetchError, TimeoutError, CanceledError } = require(path.join(ROOT, 'src/core/Fetcher'));
const Retry                                                = require(path.join(ROOT, 'src/core/Retry'));
const { JsonExtractor, JsonExtractionError }               = require(path.join(ROOT, 'src/core/JsonExtractor'));
const { parseProxy }                                       = require(path.join(ROOT, 'src/core/ProxyTunnel'));
const Fingerprint                                          = require(path.join(ROOT, 'src/modules/Fingerprint'));
const HealthMonitor                                        = require(path.join(ROOT, 'src/modules/HealthMonitor'));
const DiffDetector                                         = require(path.join(ROOT, 'src/modules/DiffDetector'));
const { SchemaValidator }                                  = require(path.join(ROOT, 'src/modules/SchemaValidator'));
const Cache                                                = require(path.join(ROOT, 'src/modules/Cache'));
const CookieJar                                            = require(path.join(ROOT, 'src/modules/CookieJar'));
const RateLimiter                                          = require(path.join(ROOT, 'src/modules/RateLimiter'));
const ProxyRotator                                         = require(path.join(ROOT, 'src/modules/ProxyRotator'));
const Interceptors                                         = require(path.join(ROOT, 'src/modules/Interceptors'));
const Webhook                                              = require(path.join(ROOT, 'src/modules/Webhook'));
const { exportData, toCSV, toNDJSON, toMarkdownTable }     = require(path.join(ROOT, 'src/utils/exporter'));

const fixtures = require('./server');

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

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const { httpsAvailable } = await fixtures.ready;
  console.log(`fixtures ready: http=9911 proxy=9913 https=${httpsAvailable ? '9912' : 'unavailable (no openssl, skipping https/proxy-tunnel tests)'}\n`);

  console.log('Fetcher — core HTTP');
  {
    const f = new Fetcher({ timeout: 5000 });

    await test('GET plain html', async () => {
      const res = await f.fetch('http://127.0.0.1:9911/html');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Hello Ryna'));
    });

    await test('gzip decompression', async () => {
      const res = await f.fetch('http://127.0.0.1:9911/gzip');
      assert.ok(res.body.includes('gzipped content'));
    });

    await test('redirect follow', async () => {
      const res = await f.fetch('http://127.0.0.1:9911/redirect');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Hello Ryna'));
    });

    await test('redirect loop throws TOO_MANY_REDIRECTS', async () => {
      const limited = new Fetcher({ timeout: 5000, maxRedirects: 2 });
      await assert.rejects(
        () => limited.fetch('http://127.0.0.1:9911/redirect-loop'),
        (err) => err.code === 'TOO_MANY_REDIRECTS',
      );
    });

    await test('4xx/5xx surfaces FetchError with status', async () => {
      await assert.rejects(
        () => f.fetch('http://127.0.0.1:9911/nope'),
        (err) => err instanceof FetchError && err.status === 404,
      );
    });

    await test('timeout rejects with TimeoutError', async () => {
      const fast = new Fetcher({ timeout: 400 });
      await assert.rejects(
        () => fast.fetch('http://127.0.0.1:9911/slow'),
        (err) => err instanceof TimeoutError && err.code === 'TIMEOUT',
      );
    });

    await test('AbortController cancels with CanceledError', async () => {
      const ctrl = new AbortController();
      const p    = f.fetch('http://127.0.0.1:9911/slow', { signal: ctrl.signal });
      setTimeout(() => ctrl.abort(), 200);
      await assert.rejects(() => p, (err) => err instanceof CanceledError && err.code === 'CANCELED');
    });

    if (httpsAvailable) {
      await test('rejectUnauthorized:false accepts self-signed https', async () => {
        const res = await f.fetch('https://127.0.0.1:9912/html', { rejectUnauthorized: false });
        assert.strictEqual(res.status, 200);
      });
    } else {
      console.log('  skip  rejectUnauthorized:false accepts self-signed https (no openssl)');
    }
  }

  console.log('\nFetcher — cookies');
  {
    const jar = new CookieJar();
    const f   = new Fetcher({ timeout: 5000, cookieJar: jar });

    await test('cookies captured from Set-Cookie and replayed', async () => {
      await f.fetch('http://127.0.0.1:9911/setcookie');
      const res = await f.fetch('http://127.0.0.1:9911/checkcookie');
      const body = JSON.parse(res.body);
      assert.ok(body.cookie.includes('session=abc123'));
      assert.ok(body.cookie.includes('theme=dark'));
    });

    await test('CookieJar.getCookieHeader returns null when empty', () => {
      const empty = new CookieJar();
      assert.strictEqual(empty.getCookieHeader('127.0.0.1'), null);
    });

    await test('CookieJar respects max-age expiry', async () => {
      const j = new CookieJar();
      j.setFromHeaders('example.com', ['a=1; Max-Age=-1']);
      assert.strictEqual(j.getCookieHeader('example.com'), null);
    });

    await test('CookieJar shares cookies across subdomains via base domain', () => {
      const j = new CookieJar();
      j.setFromHeaders('www.example.com', ['session=xyz; Path=/']);
      assert.ok(j.getCookieHeader('api.example.com').includes('session=xyz'));
    });
  }

  console.log('\nFetcher — proxy tunnel (CONNECT)');
  {
    await test('parseProxy extracts host/port/auth', () => {
      const p1 = parseProxy('http://127.0.0.1:9913');
      assert.strictEqual(p1.hostname, '127.0.0.1');
      assert.strictEqual(p1.port, 9913);
      assert.strictEqual(p1.auth, null);

      const p2 = parseProxy('http://user:pass@proxyhost:8080');
      assert.strictEqual(p2.auth, 'user:pass');
      assert.strictEqual(p2.port, 8080);
    });

    if (httpsAvailable) {
      await test('HTTPS through HTTP CONNECT proxy reaches target', async () => {
        const f   = new Fetcher({ timeout: 5000 });
        const res = await f.fetch('https://127.0.0.1:9912/html', {
          proxy: 'http://127.0.0.1:9913',
          rejectUnauthorized: false,
        });
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.includes('Hello Ryna'));
      });
    } else {
      console.log('  skip  HTTPS through HTTP CONNECT proxy reaches target (no openssl)');
    }

    await test('HTTP through proxy routes via proxy host', async () => {
      const f   = new Fetcher({ timeout: 5000 });
      const res = await f.fetch('http://127.0.0.1:9911/html', { proxy: 'http://127.0.0.1:9913' });
      assert.strictEqual(res.status, 200);
    });
  }

  console.log('\nFetcher — interceptors');
  {
    const ic = new Interceptors();
    ic.request.use((config) => {
      config.headers = { ...config.headers, 'X-Injected': 'yes' };
      return config;
    });

    let sawBody = false;
    ic.response.use((res) => {
      sawBody = true;
      return res;
    });

    ic.response.use(undefined, (err) => {
      if (err.status === 404) return { status: 404, recovered: true };
      throw err;
    });

    const f = new Fetcher({ timeout: 5000, interceptors: ic });

    await test('request interceptor injects header', async () => {
      const res     = await f.fetch('http://127.0.0.1:9911/echo-headers');
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.headers['x-injected'], 'yes');
    });

    await test('response interceptor runs on success', async () => {
      sawBody = false;
      await f.fetch('http://127.0.0.1:9911/html');
      assert.strictEqual(sawBody, true);
    });

    await test('error interceptor recovers from 404', async () => {
      const res = await f.fetch('http://127.0.0.1:9911/totally-missing');
      assert.strictEqual(res.recovered, true);
    });
  }

  console.log('\nRetry — adaptive backoff');
  {
    await test('retries until success and stops', async () => {
      let attempts = 0;
      const r = new Retry({ max: 5, jitter: false });
      const result = await r.run(async () => {
        attempts++;
        if (attempts < 3) {
          const e = new Error('fail');
          e.status = 503;
          throw e;
        }
        return 'ok';
      });
      assert.strictEqual(result, 'ok');
      assert.strictEqual(attempts, 3);
    });

    await test('throws after exceeding max retries', async () => {
      const r = new Retry({ max: 2, jitter: false });
      await assert.rejects(() => r.run(async () => {
        const e = new Error('fail');
        e.status = 500;
        throw e;
      }));
    });

    await test('never retries CANCELED errors', async () => {
      let attempts = 0;
      const r = new Retry({ max: 5 });
      await assert.rejects(() => r.run(async () => {
        attempts++;
        const e = new Error('canceled');
        e.code  = 'CANCELED';
        throw e;
      }));
      assert.strictEqual(attempts, 1);
    });

    await test('end-to-end against flaky endpoint', async () => {
      const f = new Fetcher({ timeout: 5000 });
      const r = new Retry({ max: 4, jitter: true, retryOn: [503] });
      const res = await r.run(() => f.fetch('http://127.0.0.1:9911/flaky'));
      const body = JSON.parse(res.body);
      assert.strictEqual(body.attempt, 3);
    });
  }

  console.log('\nCache');
  {
    await test('set/get roundtrip', () => {
      const c = new Cache({ ttl: 60 });
      c.set('http://x.com/a', { status: 200, body: 'hi' });
      const hit = c.get('http://x.com/a');
      assert.strictEqual(hit.body, 'hi');
    });

    await test('expires after ttl', async () => {
      const c = new Cache({ ttl: 0.05 });
      c.set('http://x.com/a', { body: 'soon-gone' });
      await wait(120);
      assert.strictEqual(c.get('http://x.com/a'), null);
    });

    await test('evicts oldest when maxItems exceeded', () => {
      const c = new Cache({ ttl: 60, maxItems: 2 });
      c.set('http://x.com/1', { body: '1' });
      c.set('http://x.com/2', { body: '2' });
      c.set('http://x.com/3', { body: '3' });
      assert.strictEqual(c.get('http://x.com/1'), null);
      assert.ok(c.get('http://x.com/3'));
    });

    await test('stats track hits/misses', () => {
      const c = new Cache({ ttl: 60 });
      c.get('miss');
      c.set('hit', { body: '1' });
      c.get('hit');
      const s = c.stats();
      assert.strictEqual(s.hits, 1);
      assert.strictEqual(s.misses, 1);
    });

    await test('disk storage mode persists and clears', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ryna-cache-'));
      const c   = new Cache({ ttl: 60, storage: 'disk', storageDir: dir });
      c.set('http://disk.com/x', { body: 'on-disk' });
      assert.strictEqual(c.get('http://disk.com/x').body, 'on-disk');
      c.clear();
      assert.strictEqual(c.get('http://disk.com/x'), null);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  }

  console.log('\nRateLimiter');
  {
    await test('spaces requests per requestsPerSecond', async () => {
      const rl = new RateLimiter({ requestsPerSecond: 10 });
      const t0 = Date.now();
      await (await rl.acquire('host-a'))();
      await (await rl.acquire('host-a'))();
      const elapsed = Date.now() - t0;
      assert.ok(elapsed >= 90, `expected >=90ms spacing, got ${elapsed}ms`);
    });

    await test('limits concurrency per hostname', async () => {
      const rl      = new RateLimiter({ concurrency: 1 });
      const release1 = await rl.acquire('host-b');
      let acquired2  = false;
      const p2 = rl.acquire('host-b').then((release2) => {
        acquired2 = true;
        release2();
      });
      await wait(50);
      assert.strictEqual(acquired2, false);
      release1();
      await p2;
      assert.strictEqual(acquired2, true);
    });

    await test('disabled limiter resolves immediately', async () => {
      const rl = new RateLimiter({});
      assert.strictEqual(rl.enabled, false);
      const t0 = Date.now();
      await (await rl.acquire('host-c'))();
      assert.ok(Date.now() - t0 < 20);
    });
  }

  console.log('\nProxyRotator');
  {
    await test('round-robin cycles in order', () => {
      const pr = new ProxyRotator({ proxies: ['p1', 'p2', 'p3'], strategy: 'round-robin' });
      assert.deepStrictEqual([pr.next(), pr.next(), pr.next(), pr.next()], ['p1', 'p2', 'p3', 'p1']);
    });

    await test('sticky returns same proxy for same hostname', () => {
      const pr = new ProxyRotator({ proxies: ['p1', 'p2', 'p3'], strategy: 'sticky' });
      const a1 = pr.next('site-a.com');
      const a2 = pr.next('site-a.com');
      assert.strictEqual(a1, a2);
    });

    await test('marks proxy unhealthy after maxFailures', () => {
      const pr = new ProxyRotator({ proxies: ['p1', 'p2'], strategy: 'round-robin', maxFailures: 2 });
      pr.reportFailure('p1');
      pr.reportFailure('p1');
      const stats = pr.stats();
      assert.strictEqual(stats.find(s => s.proxy === 'p1').healthy, false);
    });

    await test('disabled when no proxies configured', () => {
      const pr = new ProxyRotator({});
      assert.strictEqual(pr.enabled, false);
      assert.strictEqual(pr.next('x'), null);
    });
  }

  console.log('\nJsonExtractor');
  {
    const je = new JsonExtractor();

    await test('simple dot path', () => {
      const { data } = je.extract({ user: { name: 'qrtz' } }, { name: 'user.name' });
      assert.strictEqual(data.name, 'qrtz');
    });

    await test('wildcard array mapping', () => {
      const { data } = je.extract(
        { data: { items: [{ title: 'A' }, { title: 'B' }] } },
        { titles: 'data.items[].title' },
      );
      assert.deepStrictEqual(data.titles, ['A', 'B']);
    });

    await test('indexed array access', () => {
      const { data } = je.extract({ list: ['x', 'y', 'z'] }, { second: 'list[1]' });
      assert.strictEqual(data.second, 'y');
    });

    await test('required field missing throws', () => {
      assert.throws(
        () => je.extract({ a: 1 }, { b: { path: 'missing.path', required: true } }),
        JsonExtractionError,
      );
    });

    await test('transform applies to wildcard results', () => {
      const { data } = je.extract(
        { items: [{ n: 1 }, { n: 2 }] },
        { n: { path: 'items[].n', transform: (v) => v * 10 } },
      );
      assert.deepStrictEqual(data.n, [10, 20]);
    });

    await test('handles real server JSON response', async () => {
      const f   = new Fetcher({ timeout: 5000 });
      const res = await f.fetch('http://127.0.0.1:9911/json');
      const { data } = je.extract(res.body, { userName: 'data.user.name', titles: 'data.items[].title' });
      assert.strictEqual(data.userName, 'qrtz');
      assert.deepStrictEqual(data.titles, ['A', 'B']);
    });
  }

  console.log('\nSchemaValidator');
  {
    await test('required + type checks', () => {
      const v = new SchemaValidator({ name: { required: true, type: 'string' }, price: { type: 'number' } });
      const r = v.validate({ name: 'Buku', price: 'mahal' });
      assert.strictEqual(r.valid, false);
      assert.ok(r.errors.some(e => e.field === 'price'));
    });

    await test('custom validator', () => {
      const v = new SchemaValidator({ rating: { custom: (val) => (val >= 0 && val <= 5) ? true : 'out of range' } });
      const r = v.validate({ rating: 9 });
      assert.strictEqual(r.valid, false);
    });

    await test('passes clean data', () => {
      const v = new SchemaValidator({ url: { type: 'url' } });
      const r = v.validate({ url: 'https://example.com' });
      assert.strictEqual(r.valid, true);
    });
  }

  console.log('\nHealthMonitor');
  {
    await test('flags high empty rate', () => {
      const hm = new HealthMonitor({ alertThreshold: 0.5, windowSize: 10 });
      let report;
      for (let i = 0; i < 4; i++) {
        report = hm.record('http://x.com', { title: { selector: '.t', empty: true, count: 0 } });
      }
      assert.strictEqual(report.healthy, false);
      assert.ok(report.alerts.some(a => a.type === 'high_empty_rate'));
    });

    await test('flags count drop', () => {
      const hm = new HealthMonitor({ alertThreshold: 0.9 });
      hm.record('http://y.com', { items: { selector: '.i', empty: false, count: 20 } });
      hm.record('http://y.com', { items: { selector: '.i', empty: false, count: 18 } });
      const report = hm.record('http://y.com', { items: { selector: '.i', empty: false, count: 2 } });
      assert.ok(report.alerts.some(a => a.type === 'count_drop'));
    });

    await test('stays healthy on consistent data', () => {
      const hm = new HealthMonitor();
      let report;
      for (let i = 0; i < 5; i++) {
        report = hm.record('http://z.com', { title: { selector: 'h1', empty: false, count: 1 } });
      }
      assert.strictEqual(report.healthy, true);
    });
  }

  console.log('\nDiffDetector');
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ryna-diff-'));

    await test('first run reports firstRun true', () => {
      const dd = new DiffDetector({ storageDir: dir });
      const r  = dd.check('http://diff.com/a', { title: 'Hello', price: '10' });
      assert.strictEqual(r.firstRun, true);
    });

    await test('detects removed keys as critical', () => {
      const dd = new DiffDetector({ storageDir: dir });
      dd.check('http://diff.com/b', { title: 'Hello', price: '10' });
      const r = dd.check('http://diff.com/b', { title: 'Hello' });
      assert.ok(r.changes.some(c => c.type === 'keys_removed' && c.severity === 'critical'));
      assert.strictEqual(r.hasCritical, true);
    });

    await test('detects fields becoming null', () => {
      const dd = new DiffDetector({ storageDir: dir });
      dd.check('http://diff.com/c', { title: 'Hello', price: '10' });
      const r = dd.check('http://diff.com/c', { title: 'Hello', price: null });
      assert.ok(r.changes.some(c => c.type === 'fields_became_null'));
    });

    await test('detects array count drop', () => {
      const dd = new DiffDetector({ storageDir: dir });
      dd.check('http://diff.com/d', [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }]);
      const r = dd.check('http://diff.com/d', [{ a: 1 }]);
      assert.ok(r.changes.some(c => c.type === 'count_changed'));
    });

    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('\nFingerprint');
  {
    await test('buildHeaders includes UA and Accept', () => {
      const fp = new Fingerprint({});
      const h  = fp.buildHeaders();
      assert.ok(h['User-Agent']);
      assert.ok(h['Accept']);
    });

    await test('fixed userAgent is respected', () => {
      const fp = new Fingerprint({ userAgent: 'MyBot/1.0' });
      const h  = fp.buildHeaders();
      assert.strictEqual(h['User-Agent'], 'MyBot/1.0');
    });

    await test('rotation produces varied UAs over many calls', () => {
      const fp  = new Fingerprint({ userAgent: 'random', rotateUAOnEachRequest: true });
      const set = new Set();
      for (let i = 0; i < 30; i++) set.add(fp.getUA());
      assert.ok(set.size > 1);
    });

    await test('humanDelay waits within bounds', async () => {
      const fp = new Fingerprint({});
      const t0 = Date.now();
      await fp.humanDelay(50, 100);
      const elapsed = Date.now() - t0;
      assert.ok(elapsed >= 40 && elapsed <= 250, `got ${elapsed}ms`);
    });
  }

  console.log('\nWebhook');
  {
    await test('fires POST with event payload', async () => {
      let received = null;
      const srv = require('http').createServer((req, res) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          received = JSON.parse(body);
          res.writeHead(200);
          res.end('ok');
        });
      });
      await new Promise(r => srv.listen(9915, '127.0.0.1', r));

      const wh = new Webhook({ onStart: 'http://127.0.0.1:9915/hook' });
      wh.fire('onStart', { url: 'http://target.com' });

      await wait(150);
      srv.close();

      assert.ok(received);
      assert.strictEqual(received.event, 'onStart');
      assert.strictEqual(received.url, 'http://target.com');
    });

    await test('silently no-ops when event not configured', async () => {
      const wh = new Webhook({});
      wh.fire('onComplete', {});
    });
  }

  console.log('\nInterceptors — eject');
  {
    await test('ejected interceptor no longer runs', async () => {
      const ic = new Interceptors();
      const id = ic.request.use((config) => {
        config.headers = { ...config.headers, 'X-Should-Not-Appear': 'yes' };
        return config;
      });
      ic.request.eject(id);

      const f   = new Fetcher({ timeout: 5000, interceptors: ic });
      const res = await f.fetch('http://127.0.0.1:9911/echo-headers');
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.headers['x-should-not-appear'], undefined);
    });
  }

  console.log('\nExporter');
  {
    await test('toCSV escapes commas and quotes', () => {
      const csv = toCSV([{ name: 'Buku "A", edisi 2', price: 50000 }]);
      assert.ok(csv.includes('"Buku ""A"", edisi 2"'));
    });

    await test('toMarkdownTable produces valid table', () => {
      const md = toMarkdownTable([{ a: 1, b: 2 }]);
      assert.ok(md.startsWith('| a | b |'));
      assert.ok(md.includes('| --- | --- |'));
    });

    await test('toNDJSON produces one json object per line', () => {
      const nd    = toNDJSON([{ a: 1 }, { a: 2 }]);
      const lines = nd.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.deepStrictEqual(JSON.parse(lines[0]), { a: 1 });
    });

    await test('exportData writes file to disk', () => {
      const tmp = path.join(os.tmpdir(), `ryna-export-${Date.now()}.json`);
      exportData([{ x: 1 }], { format: 'json', path: tmp });
      const content = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      assert.deepStrictEqual(content, [{ x: 1 }]);
      fs.unlinkSync(tmp);
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
  console.error('test runner crashed:', err);
  fixtures.closeAll();
  process.exit(1);
});
