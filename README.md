<div align="center">

<a href="https://i.postimg.cc/0ykVqtwd/sengkrep-ryna.gif">
  <img src="https://i.postimg.cc/0ykVqtwd/sengkrep-ryna.gif" alt="sengkrep-ryna" width="100%" />
</a>

<br /><br />

<h1>sengkrep-ryna</h1>

<p><strong>A reliability layer for web scraping in Node.js, with full TypeScript support.</strong><br />
Not an HTTP client, not an HTML parser, not a framework —<br />
the layer that keeps your scraper running when everything else breaks.</p>

[![npm version](https://img.shields.io/npm/v/sengkrep-ryna?color=black&style=flat-square)](https://www.npmjs.com/package/sengkrep-ryna)
[![license](https://img.shields.io/npm/l/sengkrep-ryna?color=black&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-black?style=flat-square)](https://nodejs.org)
[![types](https://img.shields.io/badge/types-included-black?style=flat-square)](./index.d.ts)
[![dependencies](https://img.shields.io/badge/dependencies-1-black?style=flat-square)](./package.json)
[![tests](https://img.shields.io/badge/tests-244%20passing-black?style=flat-square)](./test)

</div>

---

## What's New in 3.4.0

This release focuses on a class of bug that is easy to miss in testing but costly in production: silent politeness and reliability gaps that only show up after a scraper has been running against a real target for a while.

| Problem found | Fix |
|---|---|
| `Retry-After` response header was ignored — the library used its own backoff even when the server explicitly said how long to wait | Retry now honors `Retry-After` (both delta-seconds and HTTP-date formats) by default, capped at `maxRetryAfter` |
| A connection dropped mid-response could surface as a vague "socket hang up" and, in edge cases, risked returning partial data as if it were complete | Responses are now verified via Node's own `res.complete` signal and fail clearly with `TRUNCATED_RESPONSE` instead |
| No way to check whether a path was disallowed before requesting it | `scraper.isAllowed(url)` and `scraper.getCrawlDelay(origin)` parse `robots.txt` `Disallow`/`Allow`/`Crawl-delay` directives; `crawl({ respectRobotsTxt: true })` applies this automatically |
| Broken pagination on some sites repeats the last page forever instead of stopping, wasting requests and producing duplicate data | `paginate()` now hashes each page's extracted content and stops automatically when a page is identical to the one before it (`stopOnDuplicate`, on by default) |
| Rate-limit headers (`RateLimit-Remaining`, `X-RateLimit-Remaining`, etc.) were fetched but never surfaced | Now exposed at `data._ryna.rateLimit` on every `extract()` call, so you can throttle proactively instead of waiting for a `429` |

## Table of Contents

1. [What is sengkrep-ryna?](#what-is-sengkrep-ryna)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Command Line Interface](#command-line-interface)
5. [TypeScript](#typescript)
6. [Core API Reference](#core-api-reference)
7. [Schema Syntax](#schema-syntax)
8. [Schema Inference](#schema-inference)
9. [Reliability Modules](#reliability-modules)
10. [Identity & Access Modules](#identity--access-modules)
11. [Performance Modules](#performance-modules)
12. [Data Extraction Utilities](#data-extraction-utilities)
13. [Distributed Queue](#distributed-queue)
14. [Operations & Tooling](#operations--tooling)
15. [Property Naming Reference](#property-naming-reference)
16. [Full Configuration Reference](#full-configuration-reference)
17. [Error Reference](#error-reference)
18. [Testing](#testing)
19. [Recipes](#recipes)
20. [Architecture](#architecture)
21. [Troubleshooting](#troubleshooting)
22. [License](#license)

---

## What is sengkrep-ryna?

`sengkrep-ryna` sits on top of Node.js's built-in networking modules and provides everything a long-running, production web scraper needs beyond "make a request and parse the response":

| Library | Best at |
|---|---|
| `axios` | HTTP client |
| `cheerio` | HTML parsing |
| `puppeteer` / `playwright` | Browser automation |
| `crawlee` | Scraping framework |
| **`sengkrep-ryna`** | **Reliability layer** — keeps a scraper healthy over days, weeks, or months |

It includes its own HTTP client and its own HTML parser wrapper (so it can be used standalone), but its real value is everything built around them: automatic detection of broken selectors before they silently corrupt your dataset, structural diffing between scrape runs, adaptive retry logic, circuit breakers, proxy rotation with health tracking, and safe handling of binary responses and non-UTF-8 encodings.

**When to reach for it:** your scraper needs to run unattended for an extended period, targets multiple domains with different rate limits, needs to resume after a crash, or has been silently returning corrupted data because of encoding or binary-response issues.

**When a plain `axios` + `cheerio` combo is enough:** a one-off script that scrapes a single page a single time. There's no reason to add a dependency for that.

---

## Installation

```bash
npm install sengkrep-ryna
```

Requires **Node.js 18 or later**. The only external dependency is `cheerio`; everything else (HTTP/2, DNS caching, proxy tunneling, binary detection, streaming) is implemented directly on top of Node's built-in modules.

> Some features depend on the Node runtime itself. `zstd` response decompression, for example, requires Node 22.15+ / 23.8+ (the version that added native zstd support to the `zlib` module). On older runtimes the library still works correctly — it simply raises a clear `UNSUPPORTED_ENCODING` error instead of silently corrupting the response body.

---

## Quick Start

```js
const sengkrep = require('sengkrep-ryna');

// 1. Raw HTTP request, no parsing
const res = await sengkrep.fetch('https://example.com');
console.log(res.status, res.body);

// 2. Parse HTML manually with cheerio
const $ = sengkrep.load(res.body);
console.log($('h1').text());

// 3. Fetch + parse in one call, using a schema
const data = await sengkrep.extract('https://books.toscrape.com', {
  title: 'h1',
  price: '.price_color',
});
console.log(data);
```

Or with TypeScript:

```ts
import sengkrep, { Schema, ExtractResult } from 'sengkrep-ryna';

interface Product {
  title: string;
  price: string;
}

const schema: Schema<Product> = { title: 'h1', price: '.price_color' };
const data: ExtractResult<Product> = await sengkrep.extract('https://books.toscrape.com', schema);
```

---

## Command Line Interface

The package installs a `sengkrep-ryna` executable.

```bash
sengkrep-ryna help
sengkrep-ryna fetch <url>
sengkrep-ryna discover <origin>
sengkrep-ryna scrape <url> --schema '<json>' [options]
```

### `sengkrep-ryna fetch <url>`

Prints the raw response body to stdout.

```bash
sengkrep-ryna fetch https://example.com
```

### `sengkrep-ryna discover <origin>`

Prints every URL found via `robots.txt` → `sitemap.xml`, one per line.

```bash
sengkrep-ryna discover https://example.com
```

### `sengkrep-ryna scrape <url> --schema '<json>' [options]`

| Flag | Description |
|---|---|
| `--schema <json>` | **Required.** Extraction schema as a JSON string |
| `--format <fmt>` | Output format: `json` (default), `csv`, `ndjson`, `markdown` |
| `--output <path>` | Write to a file instead of stdout |
| `--pages <n>` | Follow pagination up to `n` pages |
| `--next <selector>` | CSS selector for the "next page" link, or `auto` |
| `--items <selector>` | CSS selector for repeated item containers |
| `--proxy <url>` | Proxy URL to route requests through |
| `--delay <ms>` | Base delay between requests, in milliseconds |

```bash
sengkrep-ryna scrape https://books.toscrape.com \
  --schema '{"title":"h1","price":".price_color"}' \
  --format csv --output books.csv \
  --pages 5 --next auto
```

`--help` / `-h` (in any position) prints usage instructions.

---

## TypeScript

Type definitions ship with the package (`index.d.ts`) and are verified to compile cleanly with `tsc` — every public method, class, and option object is typed, including a generic `Schema<T>` / `ExtractResult<T>` pair so your extracted data is typed end-to-end.

```ts
import sengkrep, {
  Ryna, Schema, ExtractResult, BatchResult, RynaOptions,
  CrawlOptions, SchemaInferenceResult,
} from 'sengkrep-ryna';

interface Article {
  title: string;
  author: string;
  publishedAt: string;
}

const schema: Schema<Article> = {
  title:       { selector: ['h1.title', 'h1'], required: true },
  author:      '.author-name',
  publishedAt: { selector: 'time', attr: 'datetime' },
};

const scraper: Ryna = sengkrep.create({
  retry: { max: 3 },
  circuitBreaker: { threshold: 5 },
});

const data: ExtractResult<Article> = await scraper.extract('https://example.com/post/1', schema);
// data.title, data.author, data.publishedAt are all typed as `string`
// data._ryna is typed as RynaMeta (health, diff, validation, cache metadata)
```

Every class documented below (`SecurityGuard`, `CircuitBreaker`, `SessionPool`, `DistributedQueue`, and so on) is exported with full type coverage.

---

## Core API Reference

These methods exist both as top-level functions on the default export (using an internal shared instance) and as methods on any instance created with `sengkrep.create(options)`.

### `fetch(url, options?)`

Performs a raw HTTP(S) request. No parsing is applied — this is the equivalent of a plain HTTP client call, with all of `sengkrep-ryna`'s reliability features (retry, proxy rotation, rate limiting, caching, etc.) still applied underneath.

**Parameters**
- `url: string` — the URL to fetch.
- `options?: { params?: object, request?: RequestConfig }`
  - `params` — query-string parameters merged into the URL.
  - `request.headers` — additional request headers.
  - `request.method` — HTTP method (default `GET`).
  - `request.body` — request body for non-GET requests.
  - `request.signal` — an `AbortSignal` to cancel the request.

**Returns** `Promise<RawResponse>`:

```ts
interface RawResponse {
  status: number;
  headers: Record<string, string>;
  url: string;
  body: string;
  binary: boolean;
  streamed: boolean;
  filePath: string | null;
  fromCache: boolean;
  notModified: boolean;
  charset?: string;
}
```

```js
const res = await sengkrep.fetch('https://example.com/page');
console.log(res.status, res.headers['content-type']);
```

### `load(html)`

A direct wrapper around `cheerio.load()`. Returns a `CheerioAPI` instance you can query with jQuery-style selectors. `cheerio` itself is also exported directly as `sengkrep.cheerio`, so you never need to install it separately even though it is the package's one dependency.

```js
const $ = sengkrep.load(res.body);
$('.product').each((i, el) => console.log($(el).text()));
```

### `extract<T>(url, schema, options?)`

Fetches a URL and parses it according to `schema` in a single call. The response format (HTML, JSON, RSS/Atom, CSV) is auto-detected unless overridden.

**Parameters**
- `url: string`
- `schema: Schema<T>` — see [Schema Syntax](#schema-syntax).
- `options?: ExtractOptions`
  - `strict?: boolean` — throw a `ValidationError` if the extracted data fails validation rules (default `false`).
  - `responseType?: 'auto' | 'html' | 'json' | 'rss' | 'csv'` (default `'auto'`).
  - `params?: object` — query-string parameters.
  - `allowBinary?: boolean` — return binary-response metadata instead of throwing `BINARY_RESPONSE`.
  - `allowStreamed?: boolean` — return large-response metadata instead of throwing when the body was streamed to disk.
  - `request?: RequestConfig` — same shape as in `fetch()`.

**Returns** `Promise<ExtractResult<T>>` — your extracted fields, plus a non-enumerable `_ryna` property containing health, diff, validation, and cache metadata (it will not appear in `console.log` or `JSON.stringify` output, but is accessible directly).

```js
const data = await sengkrep.extract('https://example.com/product', {
  name:  'h1.product-title',
  price: '.price-tag',
});

console.log(data.name, data.price);
console.log(data._ryna.health?.healthy);
```

### `batch<T>(urls, schema, options?)`

Scrapes many URLs with concurrency control.

**Options** (in addition to `ExtractOptions`):
- `concurrency?: number` (default `3`)
- `delay?: number` — base delay between batches in ms (default `800`, jittered automatically)
- `randomOrder?: boolean` — shuffle the URL list before processing, for more natural load distribution
- `progressBar?: boolean` — show a terminal progress bar
- `onProgress?: (done: number, total: number) => void`

**Returns** `Promise<BatchResult<T>[]>`, where each entry is `{ url, data, error }`.

```js
const results = await scraper.batch(urls, schema, {
  concurrency: 5,
  randomOrder: true,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});

for (const { url, data, error } of results) {
  if (error) console.error(`Failed: ${url}`, error.message);
  else console.log(url, data);
}
```

### `stream<T>(urls, schema, options?)`

An async generator version of `batch()` — use it when you want to start processing results before the entire list finishes, or when scraping large URL lists where holding every result in memory at once is undesirable.

```js
for await (const { url, data, error } of scraper.stream(urls, schema, { concurrency: 5 })) {
  if (!error) await saveToDatabase(data);
}
```

### `paginate<T>(startUrl, config, schema, options?)`

Follows a "next page" link repeatedly, collecting items from each page.

**`config: PaginationConfig`**
- `nextSelector: string | 'auto'` — CSS selector for the next-page link, or `'auto'` to use the built-in heuristic detector (checks `rel="next"`, common text like "Next"/"»", common class names, and numeric URL increments). When `'auto'` is used, the library also reads pagination widgets like `.page-numbers` to estimate and log the total page count.
- `itemsSelector?: string` — CSS selector for repeated item containers on each page. If omitted, each page is extracted as a single object.
- `maxPages?: number` (default `10`)
- `delayBetweenPages?: number` (default `1200`, jittered)

```js
const items = await scraper.paginate(
  'https://books.toscrape.com/catalogue/page-1.html',
  { nextSelector: 'auto', itemsSelector: '.product_pod', maxPages: 10 },
  { title: 'h3 a', price: '.price_color' },
);
```

### `crawl(options)`

A resumable, breadth-first crawler with disk-backed state, so a crashed process can pick up exactly where it left off.

**`options: CrawlOptions`**
- `seed: string | string[]` — starting URL(s).
- `schema: Schema<T>` — extraction schema applied to every visited page.
- `follow?: RegExp | ((url: string) => boolean)` — filters which discovered links are added to the crawl queue.
- `maxUrls?: number` (default `1000`)
- `concurrency?: number` (default `3`)
- `stateFile?: string` — path to a JSON file used to persist progress. Omit to run in-memory only.

**Returns** a `CrawlJob`:
- `.start()` — begin crawling, returns `Promise<Array<{ url, data }>>`.
- `.resume()` — reload state from `stateFile` and continue.
- `.pause()` — stop after the current batch and save state.
- `.on(event, fn)` — subscribe to `'url:done'`, `'url:error'`, `'progress'`, `'start'`, or `'done'`.
- `.results()` / `.stats()` — inspect progress without stopping.

```js
const job = scraper.crawl({
  seed: 'https://example.com',
  schema: { title: 'h1' },
  follow: /\/article\//,
  maxUrls: 5000,
  stateFile: './crawl-state.json',
});

job.on('url:done', ({ url, data }) => console.log(url));
job.on('progress', ({ done, queued }) => console.log(`${done} done, ${queued} queued`));

await job.start();
// if the process crashes here, running the same script again and calling
// job.resume() instead of job.start() will continue without re-visiting
// already-completed URLs
```

### `login(url, formData?, options?)`

Submits a login form. If CSRF handling is enabled (it is, by default), the library first performs a `GET` on `url`, extracts a CSRF token from a `<meta>` tag, hidden `<input>`, or cookie, and includes it in the subsequent `POST`. The resulting session cookie is stored and reused automatically in later requests.

```js
const ok = await scraper.login('https://example.com/login', {
  username: 'me',
  password: process.env.SCRAPE_PASSWORD,
});
```

### `submitForm(url, formSelector, overrides?)`

A generalization of `login()` for arbitrary forms — fetches the page, parses the form matching `formSelector` (including its action, method, and existing field values), applies your `overrides`, and submits it.

```js
const res = await scraper.submitForm('https://example.com/search', 'form#search', { q: 'laptop' });
```

### `discover(origin, options?)`

Finds URLs via `robots.txt` → `Sitemap:` directive → `sitemap.xml` (recursing into sitemap indexes).

```js
const urls = await scraper.discover('https://example.com', { pattern: /\/product\// });
```

Returns an empty array if the target has no sitemap — that is correct, expected behavior, not an error.

### `isAllowed(url, userAgent?)`

Checks whether `url` is permitted by the target's `robots.txt`. See [robots.txt Compliance](#robotstxt-compliance) for matching rules.

```js
if (await scraper.isAllowed(url)) {
  await scraper.extract(url, schema);
}
```

### `getCrawlDelay(origin, userAgent?)`

Returns the `Crawl-delay` value (in milliseconds) declared in `robots.txt` for the given origin, or `null` if none is declared.

### `export(input, schema?, options?)`

Scrapes and serializes to a file in one call. `input` can be a single URL, an array of URLs, or data you already extracted.

```js
await scraper.export(urls, schema, { format: 'csv', path: './output/products.csv' });
```

### `inferSchema(url, options?)`

See [Schema Inference](#schema-inference) below.

---

## Schema Syntax

### HTML schemas

```js
const schema = {
  title: 'h1',                    // shorthand: a single selector
  tags:  ['.tag'],                // shorthand: multiple elements

  price: {
    selector: ['.price-v2', '.price-v1', '.price'],  // fallback chain
    required: true,
    pattern:  /^Rp[\d.,]+$/,
  },

  description: {
    selector:  '.desc',
    type:      'html',              // 'text' (default) or 'html'
    transform: (val) => val.trim(),
    default:   '',
  },

  imageUrl: {
    selector: 'img.product-photo',
    attr:     'src',
  },
};
```

**Field definition options:**

| Option | Type | Description |
|---|---|---|
| `selector` | `string \| string[]` | CSS selector, or an array tried in order until one matches non-empty content |
| `required` | `boolean` | Throw an `ExtractionError` if empty (default `false`) |
| `multiple` | `boolean` | Collect all matching elements into an array |
| `attr` | `string` | Read an HTML attribute instead of text content |
| `type` | `'text' \| 'html'` | Whether to use `.text()` or `.html()` |
| `transform` | `(value: string) => unknown` | Post-process the extracted value |
| `pattern` | `RegExp` | Flag a health-monitor mismatch if the value doesn't match |
| `default` | `unknown` | Value used when the field is empty and not required |

When a fallback array is used, the resulting `_ryna.health` report records exactly which selector in the chain actually matched, and a failed `required` field lists every selector that was attempted in its error message.

### JSON schemas

For APIs, use path notation instead of CSS selectors:

```js
const schema = {
  title: { path: ['data.name', 'data.title', 'title'] },  // fallback chain
  items: 'data.items[].name',                              // [] = wildcard over an array
  first: 'data.items[0].name',                              // [0] = specific index
};

const data = await scraper.extract(apiUrl, schema, { responseType: 'json' });
```

---

## Schema Inference

When you don't know the right selectors yet, let the library analyze the page for you.

```js
const result = await scraper.inferSchema('https://example.com/products');
```

**Returns:**

```js
{
  type: 'list',                       // or 'single' for a non-repeating page
  container: 'div.product-card',      // the detected repeating container
  itemCount: 24,
  schema: {
    title: { selector: 'h2.product-title', confidence: 0.8 },
    price: { selector: 'span.product-price', confidence: 0.9 },
    image: { selector: 'img.product-image', confidence: 0.5, attr: 'src' },
  },
  sample: { title: 'Running Shoes', price: '$45.00', image: '/img1.jpg' },
}
```

The suggested `schema` can be fed directly into `extract()`:

```js
const inferred = await scraper.inferSchema(url);
const data = await scraper.extract(url, inferred.schema);
```

This is a **purely heuristic algorithm** — it looks at repeated DOM structures, class/id naming conventions, and value shapes (does this text look like a price? a date?). It makes no network calls beyond fetching the page itself and involves no AI or external service, so it is fast, free, and fully deterministic.

**Options:**
- `hints?: string[]` — restrict inference to specific field names (`['title', 'price']`) instead of the default full set (`title`, `price`, `image`, `link`, `date`, `description`, `rating`, `author`, `category`).
- `list?: boolean` — set to `false` to force single-item inference even if a repeating container is detected.

---

## Reliability Modules

### Retry

Adaptive exponential backoff, tuned per HTTP status code (a `429` waits longer than a `500`), with randomized jitter so multiple workers don't retry in lockstep. Requests canceled via `AbortSignal` are never retried, regardless of configuration.

```js
scraper.create({
  retry: {
    max: 3,
    jitter: true,
    retryOn: [408, 429, 500, 502, 503, 504, 403],
    retryOnNetwork: true,
    retryOnTimeout: true,
    respectRetryAfter: true,   // honor a server-provided Retry-After header over the computed backoff
    maxRetryAfter: 300000,     // cap how long a Retry-After value is allowed to make us wait (5 min default)
    onRetry: ({ attempt, status, code, waitMs, respectedRetryAfter }) => {},
  },
});
```

When a `429` or `503` response includes a `Retry-After` header (either `Retry-After: 120` or an HTTP-date like `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`), that value is used instead of the computed backoff — this is what the server explicitly asked for, and following it is both more polite and more effective at avoiding an escalating block. Set `respectRetryAfter: false` to always use the computed backoff instead.

**Truncated response detection** — a connection that drops mid-transfer is verified using Node's own `res.complete` signal rather than trusted blindly. Instead of surfacing as a vague `NETWORK_ERROR` (or, worse, silently returning partial data), it's reported as a `TRUNCATED_RESPONSE` error, which is retried automatically like any other transient failure. Disable with `{ verifyLength: false }` passed to `fetch()`/`extract()`'s `request` options if you specifically need best-effort partial data instead of an error (only effective when the connection ends cleanly rather than being forcibly reset, since a hard reset has no bytes to return either way).

### Circuit Breaker

Stops sending requests to a domain that is already failing consistently, instead of retrying into a dead target.

```js
scraper.create({
  circuitBreaker: {
    threshold: 5,       // consecutive failures before opening
    cooldown: 60000,    // ms before trying again
    onOpen:  ({ key, failures }) => {},
    onClose: ({ key }) => {},
  },
});
```

States: `CLOSED` (normal) → (too many failures) → `OPEN` (all requests rejected immediately with `CircuitOpenError`) → (after `cooldown`) → `HALF_OPEN` (one test request allowed) → back to `CLOSED` on success, or `OPEN` again on failure.

### Health Monitor

Tracks a sliding window of extraction results per selector and flags when a selector starts returning empty, or when the number of matched items drops sharply.

```js
scraper.create({
  health: {
    alertThreshold: 0.5,   // fraction of empty results that triggers an alert
    windowSize: 10,        // number of recent runs to consider
    onAlert: (report) => report.alerts.forEach(a => console.warn(a.message)),
  },
});
```

### Diff Detector

Snapshots extracted data on every run and reports structural changes against the previous snapshot — the earliest possible warning that a target site's markup has changed.

```js
scraper.create({
  diff: {
    sensitivity: 'structural',  // or 'value' to also track value-level changes
    onDiff: (report) => { if (report.hasCritical) alertOncall(report.changes); },
  },
});
```

Change types, in increasing severity: `keys_added` / `fields_recovered` (info), `fields_became_null` / `count_changed` (warn), `keys_removed` / `type_changed` / `item_schema_changed` (critical).

**History methods**, available on `scraper.diff` (or its alias `scraper.diffDetector`):

- `getAllChanges(url?)` — every diff result recorded so far (optionally filtered to one URL), bounded to the most recent `maxHistory` entries (default `500`).
- `getChangedOnly(url?)` — the same, but excluding first-run and no-change entries.
- `clearHistory()` — empty the in-memory log without touching the on-disk snapshots used for future comparisons.
- `clearSnapshot(url)` / `clearAll()` — remove stored comparison snapshots.

```js
const recentChanges = scraper.diff.getChangedOnly('https://example.com/product/1');
recentChanges.forEach(r => console.log(r.changes));
```

### Incremental Requests (ETag / Last-Modified)

Skips re-processing a page when the server confirms nothing has changed (`304 Not Modified`), saving both bandwidth and time.

```js
scraper.create({ incremental: true });
```

### robots.txt Compliance

Checks `Disallow`/`Allow`/`Crawl-delay` directives before requesting a path.

```js
const allowed = await scraper.isAllowed('https://example.com/private/page');
const delay   = await scraper.getCrawlDelay('https://example.com');
```

Rule matching follows the common convention used by major crawlers: the longest matching pattern wins, and an `Allow` rule wins a tie against a `Disallow` rule of the same length. Supports `*` wildcards and `$` end-anchors. `robots.txt` is fetched once per origin and cached for the lifetime of the scraper instance.

Apply it automatically during a crawl:

```js
const job = scraper.crawl({
  seed: 'https://example.com',
  schema: { title: 'h1' },
  respectRobotsTxt: true,
  userAgent: 'my-bot',   // matched against User-agent groups in robots.txt; defaults to '*'
});
```

Disallowed URLs are skipped and reported via the `'url:error'` event with `error.code === 'ROBOTS_DISALLOWED'`, rather than silently vanishing from the results.

### Pagination Duplicate Detection

Some sites keep serving their last page of results indefinitely instead of stopping or returning a 404 once you page past the end — a common bug in older CMS and e-commerce pagination widgets. `paginate()` hashes each page's extracted content and stops automatically when a page is identical to the one immediately before it.

```js
const items = await scraper.paginate(startUrl, {
  nextSelector: 'auto',
  maxPages: 50,
  stopOnDuplicate: true,   // default; set to false if repeated content is expected and fine
}, schema);
```

---

## Identity & Access Modules

### Fingerprint

Rotates User-Agent strings, randomizes header order and `Accept-*` headers, and computes a spec-correct `Sec-Fetch-Site` value based on the actual referer/target relationship (rather than a hardcoded value) for realistic, internally-consistent requests.

```js
scraper.create({ fingerprint: { userAgent: 'random', rotateUAOnEachRequest: true } });
```

### Cookies

Enabled by default. Cookies from `Set-Cookie` are captured automatically and replayed on subsequent requests to the same domain, including subdomains. Disable with `cookies: false` if not needed.

### CSRF Handler

Used automatically by `login()` and `submitForm()`. Extracts a token from a `<meta name="csrf-token">` tag, a hidden input (`_token`, `csrf_token`, `authenticity_token`, `__RequestVerificationToken`), or a cookie (`XSRF-TOKEN`, `csrftoken`), and sends it back as both a form field and a header. This is intended for sessions you already have legitimate access to (your own account, your own site) — the same trust model as cookie handling in general.

### Auth Manager (JWT / Bearer token refresh)

```js
scraper.create({
  auth: {
    token: initialToken,
    refresh: async (oldToken) => await getNewToken(oldToken),
    refreshOn: [401],
  },
});
```

On a `401`, the token is refreshed once and the request is retried automatically. Concurrent requests that hit `401` at the same time share a single in-flight refresh instead of triggering multiple redundant refresh calls.

### Proxy Rotation

A native CONNECT-tunnel implementation for HTTPS and a forward-proxy implementation for HTTP — no external agent library required.

```js
scraper.create({
  proxies: ['http://user:pass@proxy1:8080', 'http://proxy2:8080'],
  proxyStrategy: 'sticky',   // 'round-robin' | 'random' | 'sticky'
  proxyMaxFailures: 3,
});
```

`sticky` always routes the same domain through the same proxy. A proxy that fails `proxyMaxFailures` times in a row is temporarily skipped in favor of healthier ones.

### Session Pool

Manages multiple independent sessions (separate cookie jars and fingerprints), useful when you have several legitimate accounts or API keys and want to distribute load across them. Always initialized (default size `1`), so `scraper.sessionPool` is never `null` even without explicit configuration.

```js
scraper.create({ sessionPool: { size: 5, strategy: 'least-used' } });

const session = scraper.sessionPool.next();
console.log(session.id, session.useCount);
```

---

## Performance Modules

### Cache

TTL-based response cache, **disabled by default**. When enabled, a cache hit skips the network request but extraction, health monitoring, diffing, and validation still run on every call, so metadata stays accurate.

```js
scraper.create({ cache: { ttl: 3600, storage: 'memory' } }); // or storage: 'disk'
```

### HTTP/2

Multiplexes requests over a single connection per origin, with automatic fallback if the server doesn't support it.

```js
scraper.create({ http2: true });
```

### DNS Cache

Caches resolved addresses with a TTL and round-robins across multiple A/AAAA records when a hostname has more than one.

```js
scraper.create({ dns: { ttl: 300000 } });
```

### Keep-Alive Connection Pool

Enabled by default — TCP connections are reused for requests to the same host, which is both faster for you and gentler on the target server.

### Rate Limiter

```js
scraper.create({ rateLimit: { requestsPerSecond: 2, concurrency: 3 } });
```

Limits are tracked independently per hostname.

### Large Response Handling

Responses larger than `maxMemoryBuffer` (default 10 MB) are streamed directly to a temporary file instead of being buffered in memory.

```js
const res = await scraper.fetch(largeFileUrl);
if (res.streamed) console.log('Saved to', res.filePath);
```

### Streaming File Writer

For writing very large result sets incrementally instead of building one large array in memory:

```js
const { StreamWriter } = require('sengkrep-ryna');

const writer = new StreamWriter('./output/data.csv', { format: 'csv' });
for (const item of hugeIterable) writer.write(item);
await writer.close();
```

---

## Data Extraction Utilities

### JSON-LD and Microdata

The most reliable data source on the modern web: structured data that site owners deliberately embed for search-engine rich snippets.

```js
const products = await scraper.extractJsonLd(url);      // <script type="application/ld+json">
const people    = await scraper.extractMicrodata(url);    // itemscope/itemprop attributes
const cards     = await scraper.extractDataAttributes(url, '[data-product-id]'); // data-* → camelCase object
```

### Content Safety (charset & binary detection)

Runs automatically on every `fetch()` / `extract()` call — no configuration needed.

- **Charset detection**: checks a UTF-8/UTF-16 byte-order mark, then the `Content-Type` header's `charset` parameter, then an HTML `<meta charset>` tag, falling back to UTF-8. Supports Shift-JIS, GBK, EUC-JP, Windows-1252, and other encodings natively via Node's built-in ICU support — no `iconv-lite` dependency needed.
- **Binary detection**: inspects magic bytes to identify common binary formats (PNG, JPEG, PDF, ZIP, GZIP, WOFF, and more) combined with a null-byte/control-character heuristic. A binary response causes `extract()` to throw a clear `BINARY_RESPONSE` error rather than corrupting the data into garbled text — pass `{ allowBinary: true }` if you want the raw bytes back instead.
- **Encoding safety**: if a server sends a `Content-Encoding` the current Node runtime cannot decompress (for example `zstd` on Node <22.15), the library throws a clear `UNSUPPORTED_ENCODING` error instead of silently treating the still-compressed bytes as plain text.

```js
try {
  await scraper.extract(url, schema);
} catch (err) {
  if (err.code === 'BINARY_RESPONSE') console.log('This is a', err.meta.sniffedType, 'file');
  if (err.code === 'UNSUPPORTED_ENCODING') console.log('Server used a compression format this runtime cannot handle');
}
```

### Encoding Utilities

General-purpose string decoding helpers:

```js
const {
  decodeHtmlEntities,    // '&amp;' -> '&'
  decodeUnicodeEscapes,  // '\u0048' -> 'H'
  decodeBase64, decodeHex,
  detectAndDecode,       // auto-detects base64 vs hex
  xorDecode, caesarDecode, rot13,
  parseJSONP,            // unwraps callback(...) responses
} = require('sengkrep-ryna');
```

### Script Extractor

Pulls `<script>` tags (inline and external) from a page, extracts `//# sourceMappingURL=` comments, and includes a basic code beautifier for readability. This extracts and formats code — it does not attempt to reverse security logic or defeat obfuscation designed to resist analysis.

```js
const scripts = await scraper.extractScripts(url);
const { extractSourceMapUrl, beautifyJs } = require('sengkrep-ryna');
```

### GraphQL Client

```js
const schema = await scraper.graphql.introspect(endpoint);
const data   = await scraper.graphql.query(endpoint, queryString, variables);
const items  = await scraper.graphql.queryAllPages(endpoint, queryString, { connectionPath: 'products' });
```

### WordPress Helper

Wraps WordPress's public REST API (`/wp-json/`) and `admin-ajax.php` (with nonce handling, the standard WordPress CSRF mechanism):

```js
const { data, total, totalPages } = await scraper.wordpress.restApi(origin, 'wp/v2/posts');
const allPosts = await scraper.wordpress.restApiAll(origin, 'wp/v2/posts', { per_page: 100 });
const result   = await scraper.wordpress.ajaxAction(origin, 'load_more_posts', {}, { nonceFromPage: '/blog' });
```

---

## Distributed Queue

A horizontal-scaling job queue for running many workers (processes or machines) against one shared list of work.

```js
const { DistributedQueue, MemoryAdapter } = require('sengkrep-ryna');

const queue = new DistributedQueue({ adapter: new MemoryAdapter(), maxItemRetries: 3 });
await queue.enqueue(urls);

const results = await queue.run(
  (url, workerId) => scraper.extract(url, schema),
  { concurrency: 5 },
);
```

**`maxItemRetries`** (default `3`) is important: an item that keeps failing is permanently dropped after this many attempts instead of being requeued forever, with the failure recorded as `droppedAfterRetries` in the result. Earlier versions of this feature could loop indefinitely on a persistently-failing item; this is now bounded.

**Scaling to multiple machines with Redis** — implement the four-method adapter interface yourself (this keeps the package dependency-free; you bring whichever Redis client you already use):

```js
class RedisAdapter {
  constructor(redisClient, key) { this.redis = redisClient; this.key = key; }
  async enqueue(items) { await this.redis.rpush(this.key, ...items.map(JSON.stringify)); }
  async dequeue() {
    const item = await this.redis.lpop(this.key);
    return item ? JSON.parse(item) : null;
  }
  async complete(item) {}
  async release(item) { await this.redis.rpush(this.key, JSON.stringify(item)); }
  async size() { return { queued: await this.redis.llen(this.key) }; }
}

const queue = new DistributedQueue({
  adapter: new RedisAdapter(myRedisClient, 'scrape-jobs'),
  workerId: `worker-${process.pid}`,
});
```

---

## Operations & Tooling

### Observability

```js
scraper.create({ observability: { enabled: true, port: 3001 } });
```

Visit `http://localhost:3001` for a live dashboard, or read the report programmatically:

```js
const report = scraper.getObservabilityReport();
report.successRate;
report.categories;   // { network, timeout, http4xx, http5xx, validation, security, circuit }
report.bytes;         // { sent, received }
report.topErrors;
```

### HAR Export

```js
const scraper = sengkrep.create({ har: true });
await scraper.extract(url, schema);
scraper.saveHar('./debug.har');   // open in Chrome DevTools → Network tab → Import
```

### Webhooks

```js
scraper.create({
  webhook: { onComplete: 'https://your-api.com/done', onError: 'https://your-api.com/error' },
});
```

### Plugin System

```js
const { plugins } = require('sengkrep-ryna');

scraper.plugins.use(plugins.timestamp());          // adds a scrapedAt field
scraper.plugins.use(plugins.logToFile('./log.jsonl'));

scraper.plugins.use({
  beforeRequest: ({ url, options }) => ({ url, options }),
  afterExtract:  ({ data, meta })   => { data.custom = true; return { data, meta }; },
  onError:       ({ url, error })  => {},
});
```

### Progress Bar

```js
await scraper.batch(urls, schema, { progressBar: true });
```

---

## Property Naming Reference

Some sub-clients are exposed under two names — a short form and a fully-spelled-out form — both pointing to the exact same instance. Use whichever reads better in your code:

| Short form | Full form |
|---|---|
| `scraper.auth` | `scraper.authManager` |
| `scraper.security` | `scraper.securityGuard` |
| `scraper.csrf` | `scraper.csrfHandler` |
| `scraper.health` | `scraper.healthMonitor` |
| `scraper.diff` | `scraper.diffDetector` |
| `scraper.plugins` | `scraper.pluginSystem` |
| `scraper.cache` | `scraper.cacheManager` |

The following are always present (never `null`) on any `scraper` instance, regardless of configuration: `sessionPool`, `wordpress`, `graphql`, `formHandler`, `deduplicator`, `proxyRotator`, `rateLimiter`, `fingerprint`, `observability`, `interceptors`, `cookieJar`.

The following can legitimately be `null` if explicitly disabled: `cache` (`cache: false`, the default), `circuitBreaker` (default), `incremental` (default), `diff` (`diff: false`), `health` (`health: false`).

---

## Full Configuration Reference

```js
const scraper = sengkrep.create({
  logLevel: 'info',              // 'error' | 'warn' | 'info' | 'debug'
  logPretty: true,
  baseURL: null,

  timeout: 30000,
  maxRedirects: 5,
  keepAlive: true,
  delay: 1000, delayMin: 600, delayMax: 3000,
  maxMemoryBuffer: 10 * 1024 * 1024,

  responseType: 'auto',
  cookies: true,
  http2: false,

  fingerprint: { userAgent: 'random', rotateUAOnEachRequest: true, randomizeHeaderOrder: true, randomizeTiming: true },

  retry: { max: 3, jitter: true, retryOn: [408, 429, 500, 502, 503, 504, 403], retryOnNetwork: true, retryOnTimeout: true, respectRetryAfter: true, maxRetryAfter: 300000 },

  health: { alertThreshold: 0.5, windowSize: 10, onAlert: null },      // or `false` to disable
  diff:   { storageDir: '.sengkrep-ryna', sensitivity: 'structural', onDiff: null, maxHistory: 500 }, // or `false`

  cache: false,                  // or { ttl, storage: 'memory'|'disk', storageDir, maxItems }
  circuitBreaker: false,         // or { threshold, cooldown, halfOpenMaxAttempts, onOpen, onClose }
  incremental: false,            // or true, or { storageDir }

  rateLimit: { requestsPerSecond: null, concurrency: null },

  proxies: [],
  proxyStrategy: 'round-robin',  // 'round-robin' | 'random' | 'sticky'
  proxyMaxFailures: 3,

  dns: false,                    // or true, or { ttl }

  sessionPool: { size: 1, strategy: 'round-robin' },  // strategy: 'round-robin' | 'least-used'

  security: { blockPrivateIPs: false, allowDomains: null, blockDomains: [], blockedPorts: [22,23,25,3306,5432,6379,27017] },

  auth: { type: 'bearer', token: null, refresh: null, refreshOn: [401] },
  csrf: { auto: true },

  observability: { enabled: false, port: null },
  webhook: { onStart: null, onComplete: null, onError: null, onProgress: null },
  har: false,

  validate: {},  // per-field validation rules, see below
});
```

### Validation rules

```js
scraper.create({
  validate: {
    price: { required: true, type: 'number', pattern: /^\d+(\.\d{2})?$/ },
    email: { type: 'email' },
    tags:  { minItems: 1 },
    name:  { minLength: 2, maxLength: 200, notEmpty: true },
    score: { custom: (value, allData) => (value >= 0 && value <= 100) || 'score out of range' },
  },
});
```

`type` accepts `'string' | 'number' | 'boolean' | 'url' | 'email' | 'date'`. Access results via `data._ryna.validation.{valid, errors, warnings}`, or pass `{ strict: true }` to `extract()` to throw immediately on failure.

---

## Error Reference

```js
const { errors } = require('sengkrep-ryna');
```

| Error class | `code` | Meaning |
|---|---|---|
| `FetchError` | `HTTP_ERROR` | Server returned status ≥ 400 (`err.status` has the code) |
| `TimeoutError` | `TIMEOUT` | Request exceeded its timeout |
| `CanceledError` | `CANCELED` | Aborted via `AbortSignal` |
| `FetchError` | `NETWORK_ERROR` | Connection failed |
| `FetchError` | `UNSUPPORTED_ENCODING` | Server used a `Content-Encoding` this Node runtime cannot decompress |
| `FetchError` | `TRUNCATED_RESPONSE` | Connection dropped before the response finished (retried automatically) |
| `ProxyError` | `PROXY_ERROR` | Proxy CONNECT/tunnel failed |
| `SecurityError` | `SECURITY_BLOCKED` | Request blocked by `SecurityGuard` (SSRF protection) |
| `CircuitOpenError` | `CIRCUIT_OPEN` | Circuit breaker is open for this domain (`err.retryAt` has the retry timestamp) |
| `ExtractionError` | — | A `required` HTML field was empty (`err.field`, `err.selector`) |
| `JsonExtractionError` | — | A `required` JSON field was empty (`err.field`, `err.path`) |
| `ValidationError` | — | Schema validation failed in strict mode (`err.errors`) |
| — | `BINARY_RESPONSE` | Response was detected as binary content (`err.meta.sniffedType`) |
| — | `ROBOTS_DISALLOWED` | A crawled URL was blocked by `robots.txt` (only with `respectRobotsTxt: true`) |

```js
try {
  await scraper.extract(url, schema, { strict: true });
} catch (err) {
  switch (err.code) {
    case 'HTTP_ERROR':           console.log(err.status); break;
    case 'UNSUPPORTED_ENCODING': console.log('upgrade Node or request gzip explicitly'); break;
    case 'BINARY_RESPONSE':      console.log(err.meta.sniffedType); break;
    case 'CIRCUIT_OPEN':         console.log('retry after', new Date(err.retryAt)); break;
  }
  if (err.name === 'ValidationError') err.errors.forEach(e => console.log(e.field, e.message));
}
```

---

## Testing

The package ships with 244 tests that run entirely locally against fixture servers — no external network access is required, making them safe to run in CI, offline, or in restricted environments like Termux.

```bash
npm test
```

Test files are organized by concern rather than by version history:

| File | Covers |
|---|---|
| `01-fetcher-and-extraction.js` | Core HTTP client, HTML/JSON extraction, retry backoff |
| `02-orchestration.js` | The `Ryna` orchestrator, batching, pagination, login |
| `03-reliability-modules.js` | Circuit breaker, health monitor, crawl queue, observability |
| `04-content-safety-and-utils.js` | Charset/binary detection, encoding utilities, HTTP/2 |
| `05-bugfixes-and-schema-inference.js` | Regression tests, schema inference, distributed queue |
| `06-robots-retry-pagination.js` | `Retry-After`, truncated responses, `robots.txt`, duplicate pagination |

---

## Recipes

### Fetch, inspect, then decide whether to extract

```js
const res = await sengkrep.fetch('https://example.com/product/1');
const $   = sengkrep.load(res.body);

if ($('.out-of-stock').length === 0) {
  const data = await sengkrep.extract('https://example.com/product/1', {
    name:  { selector: ['h1.name', 'h1'] },
    price: { selector: ['.price-v2', '.price'], required: true },
  });
}
```

### Infer a schema, then use it immediately

```js
const inferred = await scraper.inferSchema('https://shop.example.com/products');
console.log(`Title confidence: ${inferred.schema.title?.confidence}`);
const data = await scraper.extract('https://shop.example.com/products', inferred.schema);
```

### Resumable crawl distributed across workers

```js
const { DistributedQueue, MemoryAdapter } = require('sengkrep-ryna');
const scraper = sengkrep.create({ rateLimit: { requestsPerSecond: 3 } });

const urls  = await scraper.discover('https://example-blog.com');
const queue = new DistributedQueue({ adapter: new MemoryAdapter(), maxItemRetries: 3 });
await queue.enqueue(urls);

const results = await queue.run(
  (url) => scraper.extract(url, { title: 'h1', content: { selector: '.content', type: 'html' } }),
  { concurrency: 5 },
);
```

### A login-protected multi-page scrape

```js
const scraper = sengkrep.create({ cookies: true });
const ok = await scraper.login('https://example.com/login', { username: 'me', password: process.env.PW });

if (ok) {
  const orders = await scraper.paginate(
    'https://example.com/account/orders',
    { nextSelector: 'auto', itemsSelector: '.order-row', maxPages: 50 },
    { id: '.order-id', total: '.order-total' },
  );
}
```

---

## Architecture

```
sengkrep-ryna/
├── index.js / index.d.ts     Entry point + TypeScript definitions
├── bin/sengkrep-ryna.js       CLI
├── test/                       244 tests, no external network dependency
└── src/
    ├── Ryna.js                  Orchestrator — wires every module together
    ├── core/                     Fetcher, Http2Fetcher, ProxyTunnel, Extractor, JsonExtractor, Retry
    ├── modules/                  29 modules: reliability, identity, performance, and operational tooling
    └── utils/                    contentSafety, encodingUtils, microdata, scriptExtractor,
                                  urlUtils, streamWriter, exporter, contentHandlers
```

**Request lifecycle for `extract()`:**

```
plugins.beforeRequest → SecurityGuard → CircuitBreaker → Cache.get()
  → Retry.run()
      → RateLimiter → ProxyRotator → DnsCache
      → Fetcher / Http2Fetcher
          → Interceptors.request → Fingerprint headers → CookieJar → AuthManager
          → decompress as a stream (throws UNSUPPORTED_ENCODING on unknown encodings)
          → verify response completeness via res.complete (throws TRUNCATED_RESPONSE if dropped)
          → contentSafety: binary? stream to disk? decode charset?
          → Interceptors.response
      → on 401: AuthManager.refresh() → retry once
      → on 429/503 with Retry-After: honor server-specified wait time over computed backoff
  → Extractor / JsonExtractor / RSS / CSV parser (auto-detected, fallback selector chains)
  → HealthMonitor + DiffDetector + SchemaValidator + plugins.afterExtract
  → Observability.record + Webhook.fire
  → return ExtractResult<T> { ...data, _ryna: meta }
```

---

## Troubleshooting

**A documented method throws "is not a function"** — this almost always means an outdated copy of the package is installed. Confirm the installed version first:

```bash
node -e "console.log(require('sengkrep-ryna/package.json').version)"
```

If it doesn't match the version you intended to install, remove and reinstall:

```bash
npm uninstall sengkrep-ryna
npm install sengkrep-ryna@latest
```

**Responses come back garbled or fail JSON parsing** — the server likely used a `Content-Encoding` this Node runtime cannot decompress (for example `zstd` on Node versions older than 22.15). Since 3.2.0, this now raises a clear `UNSUPPORTED_ENCODING` error rather than silently passing corrupted bytes through. Upgrade Node, or set an explicit `Accept-Encoding: gzip, deflate` request header to discourage the server from using an unsupported encoding.

**Many requests return `503`** — check whether the *target site* is having availability issues before assuming it's a library bug. Public demo/test endpoints like `httpbin.org` are known to be unreliable; `https://books.toscrape.com` is a more stable target for verifying basic functionality.

**A selector returns nothing even though the data is visible in a browser** — the site is likely rendering content with client-side JavaScript, and `sengkrep-ryna` only parses the raw HTML response. Check "View Source" in your browser; if the data isn't there, look for the underlying JSON API call in the Network tab and use `responseType: 'json'` against that endpoint instead.

**`discover()` returns an empty array** — this is correct behavior for a site with no `sitemap.xml`, not an error.

**A distributed queue worker never finishes** — check `maxItemRetries` (default `3`). A persistently-failing item is dropped automatically after this many attempts rather than looping forever; this behavior was fixed in 3.2.0.

---

## License

MIT © qrtz
