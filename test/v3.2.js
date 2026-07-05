const assert = require('assert');
const path   = require('path');
const zlib   = require('zlib');

const ROOT     = path.join(__dirname, '..');
const sengkrep = require(ROOT);
const fixtures = require('./server');
const { Fetcher } = require(path.join(ROOT, 'src/core/Fetcher'));
const contentSafety = require(path.join(ROOT, 'src/utils/contentSafety'));

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

  console.log('Regression — silent decompression passthrough (the reported bug)');
  {
    await test('genuine zstd response decompresses correctly on this Node runtime', async () => {
      const f   = new Fetcher({ timeout: 5000 });
      const res = await f.fetch('http://127.0.0.1:9911/zstd-real');
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.via, 'zstd');
    });

    await test('unknown Content-Encoding throws UNSUPPORTED_ENCODING instead of passing raw bytes through', async () => {
      const f = new Fetcher({ timeout: 5000 });
      await assert.rejects(
        () => f.fetch('http://127.0.0.1:9911/bogus-encoding'),
        (err) => err.code === 'UNSUPPORTED_ENCODING',
      );
    });

    await test('simulated old-Node zstd unavailability throws clearly instead of corrupting body', async () => {
      const original = Object.getOwnPropertyDescriptor(zlib, 'createZstdDecompress');
      Object.defineProperty(zlib, 'createZstdDecompress', { value: undefined, writable: true, configurable: true });
      try {
        const f = new Fetcher({ timeout: 5000 });
        await assert.rejects(
          () => f.fetch('http://127.0.0.1:9911/zstd-real'),
          (err) => err.code === 'UNSUPPORTED_ENCODING' && err.message.includes('zstd'),
        );
      } finally {
        Object.defineProperty(zlib, 'createZstdDecompress', original);
      }
    });

    await test('contentSafety.inspect no longer lets a declared charset mask a strong binary signal', () => {
      const compressedLookingBytes = zlib.gzipSync(Buffer.from('irrelevant, we want the compressed bytes as-is'));
      const result = contentSafety.inspect(compressedLookingBytes, 'application/json; charset=utf-8');
      assert.strictEqual(result.isBinary, true);
    });

    await test('genuinely valid Shift-JIS text with declared charset still passes (no false positive)', () => {
      const sjisBytes = Buffer.from([0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd]);
      const result = contentSafety.inspect(sjisBytes, 'text/html; charset=Shift_JIS');
      assert.strictEqual(result.isBinary, false);
    });
  }

  console.log('\nNaming aliases (DX consistency fix)');
  {
    await test('scraper.authManager aliases scraper.auth', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.authManager, scraper.auth);
    });

    await test('scraper.securityGuard aliases scraper.security', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.securityGuard, scraper.security);
    });

    await test('scraper.csrfHandler aliases scraper.csrf', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.csrfHandler, scraper.csrf);
    });

    await test('scraper.healthMonitor aliases scraper.health', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.healthMonitor, scraper.health);
    });

    await test('scraper.diffDetector aliases scraper.diff', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.diffDetector, scraper.diff);
    });

    await test('scraper.pluginSystem aliases scraper.plugins', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.pluginSystem, scraper.plugins);
    });
  }

  console.log('\nSessionPool always initialized by default');
  {
    await test('scraper.sessionPool is never null, even without explicit config', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.ok(scraper.sessionPool);
      assert.strictEqual(typeof scraper.sessionPool.next, 'function');
    });

    await test('default sessionPool has size 1 unless configured larger', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.sessionPool.stats().length, 1);
    });

    await test('explicit sessionPool config still works', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false, sessionPool: { size: 3 } });
      assert.strictEqual(scraper.sessionPool.stats().length, 3);
    });
  }

  console.log('\nAll always-present sub-clients (no "not initialized" surprises)');
  {
    await test('every documented sub-client is non-null on a bare scraper instance', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const required = ['auth', 'security', 'csrf', 'health', 'plugins', 'sessionPool',
        'wordpress', 'graphql', 'formHandler', 'deduplicator', 'proxyRotator', 'rateLimiter',
        'fingerprint', 'observability', 'interceptors'];
      for (const key of required) {
        assert.ok(scraper[key] !== null && scraper[key] !== undefined, `scraper.${key} should not be null/undefined`);
      }
    });

    await test('diff can be legitimately null when explicitly disabled (not a bug)', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.strictEqual(scraper.diff, null);
      assert.strictEqual(scraper.diffDetector, null);
    });
  }

  console.log('\nSchema Inference');
  {
    const { inferSchema } = require(path.join(ROOT, 'src/modules/SchemaInference'));

    await test('detects repeating list container and suggests schema with confidence', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/inference-list');
      const $   = scraper.load(res.body);
      const result = inferSchema($);

      assert.strictEqual(result.type, 'list');
      assert.strictEqual(result.container, 'div.product-card');
      assert.strictEqual(result.itemCount, 3);
      assert.ok(result.schema.title.confidence > 0.5);
      assert.strictEqual(result.schema.image.attr, 'src');
      assert.strictEqual(result.schema.link.attr, 'href');
    });

    await test('sample preview reads attribute value for image/link fields, not text', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/inference-list');
      const $   = scraper.load(res.body);
      const result = inferSchema($);

      assert.strictEqual(result.sample.image, '/img1.jpg');
      assert.strictEqual(result.sample.link, '/p/1');
      assert.strictEqual(result.sample.title, 'Sepatu Lari');
    });

    await test('detects single-item page (no repeating container)', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/inference-single');
      const $   = scraper.load(res.body);
      const result = inferSchema($);

      assert.strictEqual(result.type, 'single');
      assert.strictEqual(result.schema.title.selector, 'h1.article-title');
      assert.ok(result.schema.date.confidence > 0.5);
    });

    await test('suggested schema actually works when fed into extract()', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const res = await scraper.fetch('http://127.0.0.1:9911/inference-single');
      const $   = scraper.load(res.body);
      const inferred = inferSchema($);

      const schema = {};
      for (const [key, def] of Object.entries(inferred.schema)) schema[key] = def;

      const data = await scraper.extract('http://127.0.0.1:9911/inference-single', schema);
      assert.strictEqual(data.title, 'Cara Membuat Kopi Enak');
    });

    await test('scraper.inferSchema() convenience method works end-to-end', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const result = await scraper.inferSchema('http://127.0.0.1:9911/inference-list');
      assert.strictEqual(result.type, 'list');
    });
  }

  console.log('\nDistributed Queue');
  {
    const { DistributedQueue, MemoryAdapter } = require(path.join(ROOT, 'src/modules/DistributedQueue'));

    await test('processes all items across multiple concurrent workers', async () => {
      const q = new DistributedQueue({ adapter: new MemoryAdapter() });
      await q.enqueue(['a', 'b', 'c', 'd', 'e']);
      const results = await q.run(async (item) => item.toUpperCase(), { concurrency: 3 });
      assert.strictEqual(results.filter(r => !r.error).length, 5);
    });

    await test('never infinite-loops on a persistently failing item (regression)', async () => {
      const q = new DistributedQueue({ adapter: new MemoryAdapter(), emptyRetries: 1, pollInterval: 5, maxItemRetries: 2 });
      await q.enqueue(['x', 'always-fails']);
      const start = Date.now();
      const results = await q.run(async (item) => {
        if (item === 'always-fails') throw new Error('nope');
        return item;
      }, { concurrency: 1 });
      assert.ok(Date.now() - start < 5000, 'should terminate quickly, not hang');
      const dropped = results.find(r => r.droppedAfterRetries);
      assert.ok(dropped);
      assert.strictEqual(dropped.droppedAfterRetries, 2);
    });

    await test('failed item that later succeeds is not permanently dropped', async () => {
      const q = new DistributedQueue({ adapter: new MemoryAdapter(), emptyRetries: 1, pollInterval: 5, maxItemRetries: 5 });
      await q.enqueue(['flaky']);
      let attempts = 0;
      const results = await q.run(async () => {
        attempts++;
        if (attempts < 3) throw new Error('not yet');
        return 'ok';
      }, { concurrency: 1 });
      assert.ok(results.some(r => r.result === 'ok'));
    });

    await test('custom adapter interface is honored', async () => {
      const calls = [];
      const customAdapter = {
        _items: ['only-item'],
        async enqueue() {},
        async dequeue() { return this._items.shift() ?? null; },
        async complete(item) { calls.push(`complete:${item}`); },
        async release(item) { calls.push(`release:${item}`); },
        async size() { return { queued: this._items.length }; },
      };
      const q = new DistributedQueue({ adapter: customAdapter, emptyRetries: 1, pollInterval: 5 });
      await q.run(async (item) => item, { concurrency: 1 });
      assert.deepStrictEqual(calls, ['complete:only-item']);
    });
  }

  console.log('\nCLI --help flag recognition (regression)');
  {
    const { execFileSync } = require('child_process');
    const binPath = path.join(ROOT, 'bin/sengkrep-ryna.js');

    await test('--help as first argument shows usage instead of "unknown command"', () => {
      const output = execFileSync('node', [binPath, '--help'], { encoding: 'utf8' });
      assert.ok(output.includes('Usage:'));
    });

    await test('-h shorthand also shows usage', () => {
      const output = execFileSync('node', [binPath, '-h'], { encoding: 'utf8' });
      assert.ok(output.includes('Usage:'));
    });

    await test('bare "help" command still works as before', () => {
      const output = execFileSync('node', [binPath, 'help'], { encoding: 'utf8' });
      assert.ok(output.includes('Usage:'));
    });
  }

  console.log('\nDiffDetector.getAllChanges (regression)');
  {
    const DiffDetector = require(path.join(ROOT, 'src/modules/DiffDetector'));
    const fs2 = require('fs');
    const os2 = require('os');
    const dir = fs2.mkdtempSync(path.join(os2.tmpdir(), 'ryna-diffhistory-'));

    await test('getAllChanges returns full history across multiple check() calls', () => {
      const dd = new DiffDetector({ storageDir: dir });
      dd.check('http://x.com/a', { title: 'v1' });
      dd.check('http://x.com/a', { title: 'v2' });
      dd.check('http://x.com/b', { title: 'v1' });

      const all = dd.getAllChanges();
      assert.strictEqual(all.length, 3);
    });

    await test('getAllChanges(url) filters to a single tracked url', () => {
      const dd = new DiffDetector({ storageDir: dir });
      dd.check('http://y.com/a', { v: 1 });
      dd.check('http://y.com/a', { v: 2 });
      dd.check('http://y.com/b', { v: 1 });

      const onlyA = dd.getAllChanges('http://y.com/a');
      assert.strictEqual(onlyA.length, 2);
      assert.ok(onlyA.every(r => r.url === 'http://y.com/a'));
    });

    await test('getChangedOnly excludes first-run and no-change entries', () => {
      const dd = new DiffDetector({ storageDir: dir, sensitivity: 'value' });
      dd.check('http://z.com/a', { title: 'same' });
      dd.check('http://z.com/a', { title: 'same' });
      dd.check('http://z.com/a', { title: 'different' });

      const changed = dd.getChangedOnly('http://z.com/a');
      assert.strictEqual(changed.length, 1);
    });

    await test('history respects maxHistory bound', () => {
      const dd = new DiffDetector({ storageDir: dir, maxHistory: 3 });
      for (let i = 0; i < 10; i++) dd.check('http://cap.com/a', { v: i });
      assert.strictEqual(dd.getAllChanges().length, 3);
    });

    await test('clearHistory empties the in-memory log without touching disk snapshots', () => {
      const dd = new DiffDetector({ storageDir: dir });
      dd.check('http://w.com/a', { v: 1 });
      dd.clearHistory();
      assert.strictEqual(dd.getAllChanges().length, 0);
      assert.ok(dd.storage.get('http://w.com/a'));
    });

    fs2.rmSync(dir, { recursive: true, force: true });
  }

  console.log('\nSessionPool / DistributedQueue re-verification (previously reported, confirmed working)');
  {
    await test('scraper.sessionPool is always a working instance out of the box', () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      assert.ok(scraper.sessionPool);
      assert.strictEqual(typeof scraper.sessionPool.next().id, 'number');
    });

    await test('scraper.distributedQueue() constructs and runs correctly', async () => {
      const scraper = sengkrep.create({ logLevel: 'error', diff: false });
      const dq = scraper.distributedQueue();
      await dq.enqueue(['x', 'y']);
      const results = await dq.run(async (item) => item.toUpperCase(), { concurrency: 2 });
      assert.strictEqual(results.filter(r => !r.error).length, 2);
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
  console.error('v3.2 test runner crashed:', err);
  fixtures.closeAll();
  process.exit(1);
});
