const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const ROOT     = path.join(__dirname, '..');
const sengkrep = require(ROOT);
const fixtures = require('./server');

const { SecurityGuard, SecurityError, classifyIP } = require(path.join(ROOT, 'src/modules/SecurityGuard'));
const { CircuitBreaker, CircuitOpenError }         = require(path.join(ROOT, 'src/modules/CircuitBreaker'));
const Incremental                                  = require(path.join(ROOT, 'src/modules/Incremental'));
const CsrfHandler                                  = require(path.join(ROOT, 'src/modules/CsrfHandler'));
const AuthManager                                  = require(path.join(ROOT, 'src/modules/AuthManager'));
const SessionPool                                  = require(path.join(ROOT, 'src/modules/SessionPool'));
const PluginSystem                                 = require(path.join(ROOT, 'src/modules/PluginSystem'));
const CrawlQueue                                   = require(path.join(ROOT, 'src/modules/CrawlQueue'));
const Observability                                = require(path.join(ROOT, 'src/modules/Observability'));
const HarRecorder                                  = require(path.join(ROOT, 'src/modules/HarRecorder'));
const { parseFeed, parseCSV }                      = require(path.join(ROOT, 'src/utils/contentHandlers'));
const { Fetcher }                                  = require(path.join(ROOT, 'src/core/Fetcher'));
const Interceptors                                 = require(path.join(ROOT, 'src/modules/Interceptors'));

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

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  await fixtures.ready;
  console.log('fixtures ready\n');

  console.log('SecurityGuard');
  {
    await test('classifyIP flags RFC1918 and loopback ranges', () => {
      assert.strictEqual(classifyIP('127.0.0.1'), 'loopback');
      assert.strictEqual(classifyIP('10.0.0.5'), 'private-a');
      assert.strictEqual(classifyIP('172.16.0.1'), 'private-b');
      assert.strictEqual(classifyIP('192.168.1.1'), 'private-c');
      assert.strictEqual(classifyIP('169.254.1.1'), 'link-local');
      assert.strictEqual(classifyIP('8.8.8.8'), null);
    });

    await test('classifyIP flags IPv6 loopback and unique-local', () => {
      assert.strictEqual(classifyIP('::1'), 'loopback');
      assert.strictEqual(classifyIP('fd00::1'), 'unique-local');
      assert.strictEqual(classifyIP('2001:4860:4860::8888'), null);
    });

    await test('disabled by default, allows everything', async () => {
      const guard = new SecurityGuard();
      assert.strictEqual(guard.enabled, false);
      await guard.check('http://127.0.0.1:9911/html');
    });

    await test('blockPrivateIPs rejects literal loopback IP', async () => {
      const guard = new SecurityGuard({ blockPrivateIPs: true });
      await assert.rejects(() => guard.check('http://127.0.0.1:9911/html'), SecurityError);
    });

    await test('allowDomains rejects non-matching hostname', async () => {
      const guard = new SecurityGuard({ allowDomains: ['*.example.com'] });
      await assert.rejects(() => guard.check('http://127.0.0.1:9911/html'), SecurityError);
    });

    await test('allowDomains permits glob match', async () => {
      const guard = new SecurityGuard({ allowDomains: ['127.0.0.1'] });
      await guard.check('http://127.0.0.1:9911/html');
    });

    await test('blockDomains rejects exact match', async () => {
      const guard = new SecurityGuard({ blockDomains: ['127.0.0.1'] });
      await assert.rejects(() => guard.check('http://127.0.0.1:9911/html'), SecurityError);
    });

    await test('blockedPorts rejects internal service ports', async () => {
      const guard = new SecurityGuard({ blockDomains: [] });
      assert.throws(() => guard.checkPort(6379), SecurityError);
      assert.doesNotThrow(() => guard.checkPort(9911));
    });
  }

  console.log('\nCircuitBreaker');
  {
    await test('stays closed under threshold', () => {
      const cb = new CircuitBreaker({ threshold: 3 });
      cb.recordFailure('a.com');
      cb.recordFailure('a.com');
      assert.strictEqual(cb.canRequest('a.com'), true);
    });

    await test('opens after threshold failures', () => {
      const cb = new CircuitBreaker({ threshold: 3 });
      cb.recordFailure('b.com');
      cb.recordFailure('b.com');
      cb.recordFailure('b.com');
      assert.strictEqual(cb.canRequest('b.com'), false);
      assert.throws(() => cb.assertCanRequest('b.com'), CircuitOpenError);
    });

    await test('transitions to half-open after cooldown, closes on success', () => {
      let now = 1000;
      const cb = new CircuitBreaker({ threshold: 2, cooldown: 5000, clock: () => now });
      cb.recordFailure('c.com');
      cb.recordFailure('c.com');
      assert.strictEqual(cb.canRequest('c.com'), false);

      now += 6000;
      assert.strictEqual(cb.canRequest('c.com'), true);
      assert.strictEqual(cb.getState('c.com').state, 'half_open');

      cb.recordSuccess('c.com');
      assert.strictEqual(cb.getState('c.com').state, 'closed');
    });

    await test('half-open failure re-opens immediately', () => {
      let now = 1000;
      const cb = new CircuitBreaker({ threshold: 2, cooldown: 5000, clock: () => now });
      cb.recordFailure('d.com');
      cb.recordFailure('d.com');
      now += 6000;
      cb.canRequest('d.com');
      cb.recordFailure('d.com');
      assert.strictEqual(cb.getState('d.com').state, 'open');
    });

    await test('independent domains have independent circuits', () => {
      const cb = new CircuitBreaker({ threshold: 1 });
      cb.recordFailure('x.com');
      assert.strictEqual(cb.canRequest('x.com'), false);
      assert.strictEqual(cb.canRequest('y.com'), true);
    });
  }

  console.log('\nIncremental (ETag)');
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ryna-incr-'));

    await test('no conditional headers on first request', () => {
      const inc = new Incremental({ storageDir: dir });
      assert.deepStrictEqual(inc.getConditionalHeaders('http://x.com/a'), {});
    });

    await test('records etag and replays as If-None-Match', () => {
      const inc = new Incremental({ storageDir: dir });
      inc.record('http://x.com/b', { etag: '"abc123"' }, { title: 'Hello' });
      const headers = inc.getConditionalHeaders('http://x.com/b');
      assert.strictEqual(headers['If-None-Match'], '"abc123"');
    });

    await test('getSnapshot returns previously stored extracted data', () => {
      const inc = new Incremental({ storageDir: dir });
      inc.record('http://x.com/c', { etag: '"v1"' }, { title: 'Snapshot' });
      assert.deepStrictEqual(inc.getSnapshot('http://x.com/c'), { title: 'Snapshot' });
    });

    await test('end-to-end against /etag fixture returns 304 on second hit', async () => {
      const inc = new Incremental({ storageDir: dir });
      const f   = new Fetcher({ timeout: 5000 });

      const first = await f.fetch('http://127.0.0.1:9911/etag');
      inc.record('http://127.0.0.1:9911/etag', first.headers, { content: 'fresh data', version: 1 });

      const headers = inc.getConditionalHeaders('http://127.0.0.1:9911/etag');
      const second  = await f.fetch('http://127.0.0.1:9911/etag', { headers });

      assert.strictEqual(second.status, 304);
      assert.strictEqual(second.notModified, true);
    });

    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('\nCsrfHandler');
  {
    const cheerio = require('cheerio');

    await test('extracts token from meta tag', () => {
      const csrf = new CsrfHandler();
      const $    = cheerio.load('<meta name="csrf-token" content="tok-123">');
      assert.strictEqual(csrf.extractFromHtml($), 'tok-123');
    });

    await test('extracts token from hidden input when no meta present', () => {
      const csrf = new CsrfHandler();
      const $    = cheerio.load('<input type="hidden" name="_token" value="tok-456">');
      assert.strictEqual(csrf.extractFromHtml($), 'tok-456');
    });

    await test('buildFormBody includes token as field', () => {
      const csrf = new CsrfHandler();
      const body = csrf.buildFormBody({ user: 'qrtz' }, 'tok-789');
      assert.ok(body.includes('_token=tok-789'));
      assert.ok(body.includes('user=qrtz'));
    });

    await test('buildHeaders adds X-CSRF-Token header', () => {
      const csrf = new CsrfHandler();
      const headers = csrf.buildHeaders('tok-abc', { Accept: 'json' });
      assert.strictEqual(headers['X-CSRF-Token'], 'tok-abc');
    });

    await test('end-to-end via Ryna.login against csrf-protected form', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const ok = await scraper.login('http://127.0.0.1:9911/csrf-login', {});
      assert.strictEqual(ok, true);
    });
  }

  console.log('\nAuthManager');
  {
    await test('buildHeaders adds Bearer prefix', () => {
      const auth = new AuthManager({ token: 'abc' });
      assert.strictEqual(auth.buildHeaders().Authorization, 'Bearer abc');
    });

    await test('shouldRefresh only true for configured statuses', () => {
      const auth = new AuthManager({ token: 'x', refresh: async () => 'y', refreshOn: [401] });
      assert.strictEqual(auth.shouldRefresh(401), true);
      assert.strictEqual(auth.shouldRefresh(403), false);
    });

    await test('refresh() dedupes concurrent calls', async () => {
      let calls = 0;
      const auth = new AuthManager({
        token: 'old',
        refresh: async () => { calls++; await wait(30); return 'new'; },
      });
      const [a, b] = await Promise.all([auth.refresh(), auth.refresh()]);
      assert.strictEqual(a, 'new');
      assert.strictEqual(b, 'new');
      assert.strictEqual(calls, 1);
    });

    await test('end-to-end auto-recovers from 401 via Ryna', async () => {
      const scraper = sengkrep.create({
        logLevel: 'error',
        diff: false,
        auth: {
          token: 'invalid-token',
          refresh: async () => 'valid-token',
        },
      });
      const data = await scraper.extract('http://127.0.0.1:9911/protected', { secret: 'secret' }, { responseType: 'json' });
      assert.strictEqual(data.secret, 'top-data');
    });
  }

  console.log('\nSessionPool');
  {
    await test('round-robin cycles sessions in order', () => {
      const pool = new SessionPool({ size: 2 });
      const ids  = [pool.next().id, pool.next().id, pool.next().id, pool.next().id];
      assert.deepStrictEqual(ids, [0, 1, 0, 1]);
    });

    await test('least-used picks lowest useCount session', () => {
      const pool = new SessionPool({ size: 3, strategy: 'least-used' });
      pool.get(0).useCount = 5;
      pool.get(1).useCount = 2;
      pool.get(2).useCount = 8;
      const picked = pool.next();
      assert.strictEqual(picked.id, 1);
    });

    await test('recycleAfter resets cookie jar and use count', () => {
      const pool = new SessionPool({ size: 1, recycleAfter: 2 });
      const s1 = pool.next();
      s1.cookieJar.setManual('example.com', 'session', 'abc');
      pool.next();
      const s3 = pool.next();
      assert.strictEqual(s3.useCount, 1);
      assert.strictEqual(s3.cookieJar.getCookieHeader('example.com'), null);
    });

    await test('each session has independent cookie jar', () => {
      const pool = new SessionPool({ size: 2 });
      const s0 = pool.get(0);
      const s1 = pool.get(1);
      s0.cookieJar.setManual('site.com', 'a', '1');
      assert.strictEqual(s1.cookieJar.getCookieHeader('site.com'), null);
    });
  }

  console.log('\nPluginSystem');
  {
    await test('function plugin receives the system for manual hook wiring', () => {
      const ps = new PluginSystem();
      let called = false;
      ps.use((system) => { called = true; assert.ok(system instanceof PluginSystem); });
      assert.strictEqual(called, true);
    });

    await test('object plugin with afterExtract hook mutates payload', async () => {
      const ps = new PluginSystem();
      ps.use({ afterExtract: ({ data, meta }) => { data.tagged = true; return { data, meta }; } });
      const result = await ps.run('afterExtract', { data: { a: 1 }, meta: {} });
      assert.strictEqual(result.data.tagged, true);
    });

    await test('multiple plugins chain in registration order', async () => {
      const ps = new PluginSystem();
      ps.use({ afterExtract: ({ data, meta }) => { data.order = [1]; return { data, meta }; } });
      ps.use({ afterExtract: ({ data, meta }) => { data.order.push(2); return { data, meta }; } });
      const result = await ps.run('afterExtract', { data: {}, meta: {} });
      assert.deepStrictEqual(result.data.order, [1, 2]);
    });

    await test('end-to-end plugin via Ryna.extract adds scrapedAt field', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      scraper.plugins.use(sengkrep.plugins.timestamp());
      const data = await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      assert.ok(data._ryna);
      assert.ok(data.scrapedAt);
    });
  }

  console.log('\nStreaming');
  {
    await test('scraper.stream yields results as async iterator', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const collected = [];
      for await (const item of scraper.stream(
        ['http://127.0.0.1:9911/html', 'http://127.0.0.1:9911/json', 'http://127.0.0.1:9911/nope'],
        { title: '#title' },
        { concurrency: 2, delay: 30 },
      )) {
        collected.push(item);
      }
      assert.strictEqual(collected.length, 3);
      assert.strictEqual(collected.filter(c => c.error).length, 1);
    });
  }

  console.log('\nCrawlQueue');
  {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ryna-crawl-'));

    function fakeVisit(graph) {
      return async (url) => {
        const page = graph[url];
        if (!page) throw new Error(`404 ${url}`);
        return { data: { title: page.title }, links: page.links };
      };
    }

    const graph = {
      '/a': { title: 'A', links: ['/b', '/c'] },
      '/b': { title: 'B', links: ['/d'] },
      '/c': { title: 'C', links: [] },
      '/d': { title: 'D', links: [] },
    };

    await test('BFS visits all reachable urls from seed', async () => {
      const q = new CrawlQueue({ seed: '/a', maxUrls: 10, concurrency: 2 });
      const results = await q.start(fakeVisit(graph));
      const urls    = results.map(r => r.url).sort();
      assert.deepStrictEqual(urls, ['/a', '/b', '/c', '/d']);
    });

    await test('respects maxUrls cap', async () => {
      const q = new CrawlQueue({ seed: '/a', maxUrls: 2, concurrency: 1 });
      const results = await q.start(fakeVisit(graph));
      assert.ok(results.length <= 2);
    });

    await test('follow filter excludes non-matching links', async () => {
      const q = new CrawlQueue({ seed: '/a', maxUrls: 10, follow: (u) => u !== '/c' });
      const results = await q.start(fakeVisit(graph));
      const urls    = results.map(r => r.url);
      assert.ok(!urls.includes('/c'));
      assert.ok(urls.includes('/b'));
    });

    await test('emits url:done and progress events', async () => {
      const q = new CrawlQueue({ seed: '/a', maxUrls: 10 });
      const doneEvents = [];
      q.on('url:done', (e) => doneEvents.push(e.url));
      await q.start(fakeVisit(graph));
      assert.ok(doneEvents.includes('/a'));
      assert.ok(doneEvents.includes('/d'));
    });

    await test('state persists and resume continues without re-visiting', async () => {
      const stateFile = path.join(stateDir, 'job.json');
      const q1 = new CrawlQueue({ seed: '/a', maxUrls: 1, stateFile, saveEvery: 1 });
      await q1.start(fakeVisit(graph));

      assert.ok(fs.existsSync(stateFile));
      const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      assert.ok(saved.visited.length >= 1);

      const q2 = new CrawlQueue({ seed: '/a', maxUrls: 10, stateFile, saveEvery: 1 });
      const finalResults = await q2.resume(fakeVisit(graph));
      const urls = finalResults.map(r => r.url).sort();
      assert.deepStrictEqual(urls, ['/a', '/b', '/c', '/d']);
    });

    await test('end-to-end scraper.crawl against local link graph', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const job = scraper.crawl({
        seed: 'http://127.0.0.1:9911/crawl-a',
        schema: { title: 'h1' },
        follow: /\/crawl-/,
        maxUrls: 10,
        concurrency: 2,
      });
      const results = await job.start();
      const titles  = results.map(r => r.data.title).sort();
      assert.deepStrictEqual(titles, ['Page A', 'Page B', 'Page C', 'Page D']);
    });

    fs.rmSync(stateDir, { recursive: true, force: true });
  }

  console.log('\nObservability');
  {
    await test('report computes successRate and rps', () => {
      const obs = new Observability({ enabled: false });
      obs.recordSuccess('http://a.com/1');
      obs.recordSuccess('http://a.com/2');
      obs.recordFailure('http://b.com/1', { status: 500 });
      const r = obs.report();
      assert.strictEqual(r.total, 3);
      assert.strictEqual(r.success, 2);
      assert.strictEqual(r.failed, 1);
      assert.strictEqual(r.successRate, 66.7);
    });

    await test('tracks per-domain breakdown', () => {
      const obs = new Observability({ enabled: false });
      obs.recordSuccess('http://shop.com/1');
      obs.recordFailure('http://shop.com/2', { status: 429 });
      const r = obs.report();
      assert.strictEqual(r.domains['shop.com'].requests, 2);
      assert.strictEqual(r.domains['shop.com'].failed, 1);
    });

    await test('dashboard server serves JSON stats endpoint', async () => {
      const obs = new Observability({ enabled: true, port: 9920 });
      obs.recordSuccess('http://x.com/1');

      const f   = new Fetcher({ timeout: 5000 });
      const res = await f.fetch('http://127.0.0.1:9920/api/stats');
      const body = JSON.parse(res.body);
      assert.strictEqual(body.total, 1);
      obs.close();
    });

    await test('end-to-end via Ryna records success/failure automatically', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      try { await scraper.extract('http://127.0.0.1:9911/nope', { title: '#title' }); } catch {}
      const report = scraper.getObservabilityReport();
      assert.strictEqual(report.total, 2);
      assert.strictEqual(report.success, 1);
      assert.strictEqual(report.failed, 1);
    });
  }

  console.log('\nHarRecorder');
  {
    await test('captures request/response into HAR entries', async () => {
      const ic  = new Interceptors();
      const har = new HarRecorder().attach(ic);
      const f   = new Fetcher({ timeout: 5000, interceptors: ic });

      await f.fetch('http://127.0.0.1:9911/html');
      await f.fetch('http://127.0.0.1:9911/json');

      const output = har.toHAR();
      assert.strictEqual(output.log.version, '1.2');
      assert.strictEqual(output.log.entries.length, 2);
      assert.strictEqual(output.log.entries[0].response.status, 200);
    });

    await test('save() writes valid HAR json to disk', async () => {
      const ic  = new Interceptors();
      const har = new HarRecorder().attach(ic);
      const f   = new Fetcher({ timeout: 5000, interceptors: ic });
      await f.fetch('http://127.0.0.1:9911/html');

      const tmp = path.join(os.tmpdir(), `ryna-har-${Date.now()}.har`);
      har.save(tmp);
      const parsed = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      assert.strictEqual(parsed.log.entries.length, 1);
      fs.unlinkSync(tmp);
    });
  }

  console.log('\nContent handlers — RSS/Atom + CSV');
  {
    await test('parseFeed parses RSS 2.0 items', () => {
      const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><item><title>Post One</title><link>http://x.com/1</link></item></channel></rss>';
      const feed = parseFeed(xml);
      assert.strictEqual(feed.type, 'rss');
      assert.strictEqual(feed.items.length, 1);
      assert.strictEqual(feed.items[0].title, 'Post One');
    });

    await test('parseFeed parses Atom entries', () => {
      const xml = '<?xml version="1.0"?><feed><title>Atom Feed</title><entry><title>Entry One</title><link href="http://x.com/e1"/></entry></feed>';
      const feed = parseFeed(xml);
      assert.strictEqual(feed.type, 'atom');
      assert.strictEqual(feed.items[0].link, 'http://x.com/e1');
    });

    await test('parseCSV handles quoted fields with commas', () => {
      const rows = parseCSV('name,price\n"Buku A, edisi 2",50000\nBuku B,75000');
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].name, 'Buku A, edisi 2');
      assert.strictEqual(rows[1].price, '75000');
    });

    await test('end-to-end feed extraction via Ryna auto-detect', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const feed = await scraper.extract('http://127.0.0.1:9911/feed.xml', {});
      assert.strictEqual(feed.type, 'rss');
      assert.strictEqual(feed.items.length, 2);
    });

    await test('end-to-end csv extraction via Ryna auto-detect', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const rows = await scraper.extract('http://127.0.0.1:9911/data.csv', {});
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].name, 'Buku A');
    });
  }

  console.log('\nWordPress');
  {
    await test('restApi fetches wp-json endpoint and parses pagination headers', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const { data, total, totalPages } = await scraper.wordpress.restApi('http://127.0.0.1:9911', 'wp/v2/posts');
      assert.strictEqual(data.length, 2);
      assert.strictEqual(total, 2);
      assert.strictEqual(totalPages, 1);
    });

    await test('extractNonce parses ajax_object pattern', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const nonce = scraper.wordpress.extractNonce('var ajax_object = {"ajax_url":"\\/wp-admin\\/admin-ajax.php","nonce":"wp-nonce-123"};');
      assert.strictEqual(nonce, 'wp-nonce-123');
    });

    await test('ajaxAction harvests nonce from page then submits action', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const result = await scraper.wordpress.ajaxAction('http://127.0.0.1:9911', 'load_more', {}, {
        nonceFromPage: '/wp-page',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.action, 'load_more');
    });
  }

  console.log('\nGraphQLClient');
  {
    await test('introspect parses schema types and fields', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const schema  = await scraper.graphql.introspect('http://127.0.0.1:9911/graphql');
      assert.strictEqual(schema.queryType, 'Query');
      assert.ok(schema.types.Product);
      assert.ok(schema.types.Product.fields.some(f => f.name === 'title'));
    });

    await test('query executes and returns data', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const data = await scraper.graphql.query('http://127.0.0.1:9911/graphql', 'query { products { edges { node { id title } } } }');
      assert.strictEqual(data.products.edges.length, 2);
    });

    await test('flattenConnection extracts nodes from edges', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const flat = scraper.graphql.flattenConnection({ edges: [{ node: { id: '1' } }, { node: { id: '2' } }] });
      assert.deepStrictEqual(flat, [{ id: '1' }, { id: '2' }]);
    });

    await test('queryAllPages stops when hasNextPage is false', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const items = await scraper.graphql.queryAllPages(
        'http://127.0.0.1:9911/graphql',
        'query($first:Int,$after:String) { products(first:$first, after:$after) { edges { node { id title } } pageInfo { hasNextPage endCursor } } }',
        { connectionPath: 'products' },
      );
      assert.strictEqual(items.length, 2);
    });
  }

  console.log('\nSecurityGuard — wired into Ryna');
  {
    await test('blockPrivateIPs blocks own test server via Ryna.extract', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false, security: { blockPrivateIPs: true } });
      await assert.rejects(
        () => scraper.extract('http://127.0.0.1:9911/html', { title: '#title' }),
        SecurityError,
      );
    });
  }

  console.log('\nCircuitBreaker — wired into Ryna');
  {
    await test('opens after repeated 404s and blocks further requests', async () => {
      const scraper = sengkrep.create({
        logLevel: 'error', diff: false,
        retry: { max: 0 },
        circuitBreaker: { threshold: 2, cooldown: 60000 },
      });

      await assert.rejects(() => scraper.extract('http://127.0.0.1:9911/nope', {}));
      await assert.rejects(() => scraper.extract('http://127.0.0.1:9911/nope', {}));
      await assert.rejects(
        () => scraper.extract('http://127.0.0.1:9911/nope', {}),
        (err) => err.code === 'CIRCUIT_OPEN',
      );
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
  console.error('v3 test runner crashed:', err);
  fixtures.closeAll();
  process.exit(1);
});
