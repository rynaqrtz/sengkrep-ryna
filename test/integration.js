const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const ROOT     = path.join(__dirname, '..');
const sengkrep = require(ROOT);
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

async function main() {
  await fixtures.ready;
  console.log('fixtures ready\n');

  console.log('Ryna.extract — HTML mode');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('extracts simple html schema', async () => {
      const data = await scraper.extract('http://127.0.0.1:9911/html', {
        title: '#title',
        price: '.price',
      });
      assert.strictEqual(data.title, 'Hello Ryna');
      assert.strictEqual(data.price, '£12.99');
    });

    await test('_ryna meta is non-enumerable but accessible', async () => {
      const data = await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      assert.strictEqual(Object.keys(data).includes('_ryna'), false);
      assert.ok(data._ryna);
      assert.strictEqual(data._ryna.responseType, 'html');
    });
  }

  console.log('\nRyna.extract — JSON auto-detect');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('auto-detects JSON content-type and uses JsonExtractor', async () => {
      const data = await scraper.extract('http://127.0.0.1:9911/json', {
        userName: 'data.user.name',
        titles:   'data.items[].title',
      });
      assert.strictEqual(data.userName, 'qrtz');
      assert.deepStrictEqual(data.titles, ['A', 'B']);
      assert.strictEqual(data._ryna.responseType, 'json');
    });

    await test('auto-detects JSON by sniffing body when content-type is text/plain', async () => {
      const data = await scraper.extract('http://127.0.0.1:9911/json-no-ct', { ok: 'ok', n: 'n' });
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.n, 42);
    });
  }

  console.log('\nRyna — cache integration');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false, cache: { ttl: 60 } });

    await test('second extract is served from cache', async () => {
      const first  = await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      const second = await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      assert.strictEqual(first._ryna.cache.hit, false);
      assert.strictEqual(second._ryna.cache.hit, true);
    });
  }

  console.log('\nRyna — validation strict mode');
  {
    const scraper = sengkrep.create({
      logLevel: 'error',
      diff: false,
      validate: { missingField: { required: true } },
    });

    await test('throws ValidationError in strict mode', async () => {
      await assert.rejects(
        () => scraper.extract('http://127.0.0.1:9911/html', { title: '#title', missingField: '.nope' }, { strict: true }),
        (err) => err.name === 'ValidationError',
      );
    });

    await test('non-strict mode returns data with validation warnings in meta', async () => {
      const data = await scraper.extract('http://127.0.0.1:9911/html', { title: '#title', missingField: '.nope' });
      assert.strictEqual(data._ryna.validation.valid, false);
    });
  }

  console.log('\nRyna — proxy rotation reporting');
  {
    const scraper = sengkrep.create({
      logLevel: 'error',
      diff: false,
      proxies: ['http://127.0.0.1:9913'],
      proxyStrategy: 'round-robin',
    });

    await test('successful request reports proxy success', async () => {
      await scraper.extract('http://127.0.0.1:9911/html', { title: '#title' });
      const stats = scraper.proxyRotator.stats();
      assert.strictEqual(stats[0].failures, 0);
      assert.strictEqual(stats[0].healthy, true);
    });
  }

  console.log('\nRyna.batch');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('batches multiple urls with concurrency', async () => {
      const results = await scraper.batch(
        ['http://127.0.0.1:9911/html', 'http://127.0.0.1:9911/json', 'http://127.0.0.1:9911/nope'],
        { title: '#title' },
        { concurrency: 2, delay: 50 },
      );
      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].error, null);
      assert.ok(results[2].error);
    });
  }

  console.log('\nRyna.paginate');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('walks pages via nextSelector and collects items', async () => {
      const items = await scraper.paginate(
        'http://127.0.0.1:9911/items',
        { nextSelector: '.next-link', itemsSelector: '.card', maxPages: 5, delayBetweenPages: 50 },
        { name: '.t', id: { selector: '.card', attr: 'data-id' } },
      );
      assert.strictEqual(items.length, 3);
      assert.strictEqual(items[0].name, 'Item One');
      assert.strictEqual(items[2].name, 'Item Three');
    });
  }

  console.log('\nRyna.login + session cookies');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('login persists cookies for subsequent extract calls', async () => {
      const ok = await scraper.login('http://127.0.0.1:9911/login', { user: 'qrtz', pass: 'secret' });
      assert.strictEqual(ok, true);

      const data = await scraper.extract('http://127.0.0.1:9911/checkcookie', { cookie: 'cookie' }, { responseType: 'json' });
      assert.ok(data.cookie.includes('authed=1'));
    });
  }

  console.log('\nRyna.discover');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('discovers urls via robots.txt -> sitemap.xml', async () => {
      const urls = await scraper.discover('http://127.0.0.1:9911');
      assert.strictEqual(urls.length, 2);
      assert.ok(urls.includes('http://127.0.0.1:9911/html'));
      assert.ok(urls.includes('http://127.0.0.1:9911/json'));
    });
  }

  console.log('\nRyna.export');
  {
    const scraper = sengkrep.create({ logLevel: 'error', diff: false });

    await test('exports batch results to csv file', async () => {
      const tmp = path.join(os.tmpdir(), `ryna-batch-export-${Date.now()}.csv`);
      await scraper.export(
        ['http://127.0.0.1:9911/html', 'http://127.0.0.1:9911/html'],
        { title: '#title' },
        { format: 'csv', path: tmp },
      );
      const content = fs.readFileSync(tmp, 'utf8');
      assert.ok(content.includes('title'));
      assert.ok(content.includes('Hello Ryna'));
      fs.unlinkSync(tmp);
    });

    await test('exports already-extracted data without re-scraping', async () => {
      const tmp = path.join(os.tmpdir(), `ryna-preextracted-export-${Date.now()}.json`);
      await scraper.export([{ a: 1 }, { a: 2 }], undefined, { format: 'json', path: tmp });
      const content = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      assert.deepStrictEqual(content, [{ a: 1 }, { a: 2 }]);
      fs.unlinkSync(tmp);
    });

    await test('exports paginated crawl directly to markdown', async () => {
      const tmp = path.join(os.tmpdir(), `ryna-paginated-export-${Date.now()}.md`);
      await scraper.export(
        'http://127.0.0.1:9911/items',
        { name: '.t' },
        {
          pagination: { nextSelector: '.next-link', itemsSelector: '.card', maxPages: 5 },
          format: 'markdown',
          path: tmp,
        },
      );
      const content = fs.readFileSync(tmp, 'utf8');
      assert.ok(content.includes('Item One'));
      assert.ok(content.includes('Item Three'));
      fs.unlinkSync(tmp);
    });
  }

  console.log('\nDiscover module directly');
  {
    const Discover = require(path.join(ROOT, 'src/modules/Discover'));
    const { Fetcher } = require(path.join(ROOT, 'src/core/Fetcher'));

    await test('fromSitemap parses urlset locs', async () => {
      const f = new Fetcher({ timeout: 5000 });
      const d = new Discover(f);
      const urls = await d.fromSitemap('http://127.0.0.1:9911/sitemap.xml');
      assert.strictEqual(urls.length, 2);
    });

    await test('fromSitemap recurses into sitemap index (depth 1)', async () => {
      const f = new Fetcher({ timeout: 5000 });
      const d = new Discover(f);
      const urls = await d.fromSitemap('http://127.0.0.1:9911/sitemap-index.xml', { maxDepth: 1 });
      assert.strictEqual(urls.length, 2);
      assert.ok(urls.includes('http://127.0.0.1:9911/a1'));
      assert.ok(urls.includes('http://127.0.0.1:9911/b1'));
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
  console.error('integration runner crashed:', err);
  fixtures.closeAll();
  process.exit(1);
});
