<div align="center">

<a href="https://i.postimg.cc/0jSV8SX3/sengkrep-ryna.webp">
  <img src="https://i.postimg.cc/0jSV8SX3/sengkrep-ryna.webp" alt="sengkrep-ryna" width="100%" />
</a>

<br /><br />

<h1>sengkrep-ryna</h1>

<p><strong>Scraping reliability layer untuk Node.js.</strong><br />
Schema validation 路 Selector health monitor 路 Smart retry 路 Fingerprint randomizer 路 Diff detector<br />
Smart cache 路 Cookie sessions 路 Proxy rotation 路 Rate limiter 路 Interceptors 路 JSON API extraction 路 Sitemap discovery</p>

[![npm version](https://img.shields.io/npm/v/sengkrep-ryna?color=black&style=flat-square)](https://www.npmjs.com/package/sengkrep-ryna)
[![node](https://img.shields.io/node/v/sengkrep-ryna?color=black&style=flat-square)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-1-black?style=flat-square)](https://www.npmjs.com/package/sengkrep-ryna?activeTab=dependencies)
[![tests](https://img.shields.io/badge/tests-78%20passing-black?style=flat-square)](https://www.npmjs.com/package/sengkrep-ryna)

</div>

---

## v2.0.0 鈥� Major Upgrade

v1 adalah reliability layer. v2 adalah itu plus toolkit lengkap buat ngehandle masalah-masalah yang baru muncul setelah scraper lo jalan lama: session/login, IP block, rate limit, dan ekstraksi dari JSON API (bukan cuma HTML). Semua ditambahin **tanpa nambah dependency baru** 鈥� masih cuma `cheerio`.

| Fitur | v1.0.0 | v2.0.0 |
|---|---|---|
| Schema Validator | 鉁� | 鉁� |
| Selector Health Monitor | 鉁� | 鉁� |
| Smart Retry (adaptive backoff + jitter) | 鉁� | 鉁� + never retries canceled requests |
| Request Fingerprint Randomizer | 鉁� | 鉁� |
| Diff Detector | 鉁� | 鉁� |
| Smart Cache (TTL, memory/disk) | 鉂� | 鉁� **BARU** |
| Cookie Jar + Session Login | 鉂� | 鉁� **BARU** |
| Proxy Rotation (round-robin/random/sticky + health tracking) | 鉂� | 鉁� **BARU** |
| Per-domain Rate Limiter | 鉂� | 鉁� **BARU** |
| Interceptors (request/response middleware) | 鉂� | 鉁� **BARU** |
| Cancel Request (AbortController) | 鉂� | 鉁� **BARU** |
| TimeoutError vs CanceledError (distinct classes) | 鉂� | 鉁� **BARU** |
| JSON API Extraction (schema-based, bukan cuma HTML) | 鉂� | 鉁� **BARU** |
| Auto-detect HTML vs JSON response | 鉂� | 鉁� **BARU** |
| Sitemap + robots.txt Discovery | 鉂� | 鉁� **BARU** |
| Multi-format Export (csv/json/ndjson/markdown) | 鉂� | 鉁� **BARU** |
| Webhook Notifications | 鉂� | 鉁� **BARU** |
| baseURL + auto query params | 鉂� | 鉁� **BARU** |
| rejectUnauthorized override (self-signed/dev cert) | 鉂� | 鉁� **BARU** |
| Local test suite (zero network dependency) | 鉂� | 鉁� **BARU**, 78 test |
| Dependencies | 1 (cheerio) | 1 (cheerio) |

---

## Kenapa sengkrep-ryna?

Library scraping biasanya fokus ke *gimana cara ambil data*. `sengkrep-ryna` fokus ke masalah yang datang setelah itu 鈥� dan sekarang juga ke masalah yang datang **sebelum** itu (akses, sesi, IP block).

Masalah nyata yang sering terjadi:

- Selector berubah diam-diam karena website deploy ulang 鈥� nggak ada yang alert
- Data yang dihasilkan pass validation tapi strukturnya sudah beda dari kemarin
- Rate limit kena, scraper mati, dan retry langsung hammer server makin cepat
- Request pattern terlalu robotic 鈥� UA sama, header urutan sama, timing sama 鈥� langsung diblokir
- Situs butuh login dulu sebelum data bisa diakses, dan session-nya hilang tiap request baru
- Satu IP kena ban permanen karena nggak ada rotasi
- Banyak situs modern nggak render data di HTML 鈥� data-nya datang dari endpoint JSON internal yang dipanggil via `fetch()`/XHR di belakang layar
- Refetch URL yang sama berkali-kali padahal datanya belum berubah, buang-buang quota & waktu

`sengkrep-ryna` hadir sebagai lapisan yang lo **wrapper** di atas scraper lo yang sudah ada, atau pakai langsung sebagai scraper lengkap.

---

## Fitur

| Modul | Fungsi |
|---|---|
| **Schema Validator** | Validasi hasil scrape terhadap aturan type, pattern, dan custom function |
| **Selector Health Monitor** | Track empty-rate dan count-drop per selector, alert kalau mulai aneh |
| **Smart Retry** | Adaptive delay per HTTP status code dengan jitter, bukan sekedar `sleep(1000)` |
| **Request Fingerprint** | Randomize UA, header order, Accept-Language, Sec-CH-UA, timing antar request |
| **Diff Detector** | Simpan snapshot tiap run, bandingkan strukturnya, alert kalau ada yang berubah |
| **Smart Cache** | TTL-based response cache, memory atau disk, skip network kalau masih fresh |
| **Cookie Jar** | Auto-capture & replay cookie per domain, support login/session flow |
| **Proxy Rotator** | Round-robin/random/sticky proxy rotation dengan CONNECT tunnel native (tanpa dependency tambahan) |
| **Rate Limiter** | Token-bucket per hostname, cegah hammering satu domain |
| **Interceptors** | Axios-style request/response middleware, termasuk error recovery |
| **JSON Extractor** | Schema-based extraction dari JSON API pakai path notation (`data.items[].title`) |
| **Discover** | Auto-temukan URL dari `robots.txt` + `sitemap.xml`, termasuk sitemap index bertingkat |
| **Exporter** | Export ke CSV, JSON, NDJSON, atau Markdown table |
| **Webhook** | Notifikasi realtime ke endpoint lo sendiri saat start/complete/error/progress |
| **Auto-Pagination** | Loop halaman otomatis dengan `nextSelector` |
| **Batch Scraping** | Scrape banyak URL dengan concurrency control |

---

## Instalasi

```bash
npm install sengkrep-ryna
```

Satu-satunya dependency eksternal: `cheerio` untuk HTML parsing. Semua fitur lain (proxy tunnel, cookie jar, cache, rate limiter, dst) dibangun di atas built-in Node.js modules saja.

---

## Quick Start

```js
const sengkrep = require('sengkrep-ryna');

const data = await sengkrep('https://books.toscrape.com', {
  title: 'h1',
  price: '.price_color',
  instock: '.availability',
});

console.log(data);
```

---

## Table of Contents

- [Core API](#core-api)
  - [sengkrep(url, schema, options)](#sengkrepurl-schema-options)
  - [sengkrep.create(options)](#sengkrepcreate-options)
  - [scraper.extract(url, schema, options)](#scraperextract)
  - [scraper.batch(urls, schema, options)](#scraperbatch)
  - [scraper.paginate(startUrl, config, schema, options)](#scraperpaginate)
  - [scraper.login(url, formData, options)](#scraperlogin)
  - [scraper.discover(origin, options)](#scraperdiscover)
  - [scraper.export(input, schema, options)](#scraperexport)
- [Schema Syntax](#schema-syntax)
  - [HTML Schema](#html-schema)
  - [JSON Schema](#json-schema)
- [Modules](#modules)
  - [Schema Validator](#schema-validator)
  - [Selector Health Monitor](#selector-health-monitor)
  - [Smart Retry](#smart-retry)
  - [Request Fingerprint](#request-fingerprint)
  - [Diff Detector](#diff-detector)
  - [Smart Cache](#smart-cache)
  - [Cookie Jar & Sessions](#cookie-jar--sessions)
  - [Proxy Rotation](#proxy-rotation)
  - [Rate Limiter](#rate-limiter)
  - [Interceptors](#interceptors)
  - [Sitemap Discovery](#sitemap-discovery)
  - [Multi-format Export](#multi-format-export)
  - [Webhook Notifications](#webhook-notifications)
- [Configuration Reference](#configuration-reference)
- [Error Handling](#error-handling)
- [Accessing Meta (_ryna)](#accessing-meta-_ryna)
- [Testing](#testing)
- [Examples](#examples)
- [Architecture](#architecture)
- [Tips & Troubleshooting](#tips--troubleshooting)
- [License](#license)

---

## Core API

### `sengkrep(url, schema, options)`

Fungsi utama. Fetch URL lalu extract data sesuai schema. Auto-detect HTML atau JSON.

```js
const sengkrep = require('sengkrep-ryna');

const data = await sengkrep('https://example.com/product', {
  name:  'h1.product-title',
  price: '.price-tag',
  stock: '.availability',
});
```

---

### `sengkrep.create(options)`

Buat instance Ryna dengan konfigurasi khusus. Semua modul dikonfigurasi di sini.

```js
const scraper = sengkrep.create({
  logLevel: 'debug',
  baseURL:  'https://example.com',

  fingerprint: {
    userAgent: 'random',
    rotateUAOnEachRequest: true,
    randomizeHeaderOrder: true,
    randomizeTiming: true,
  },

  retry: {
    max: 4,
    jitter: true,
    retryOn: [408, 429, 500, 502, 503, 504],
  },

  health: {
    alertThreshold: 0.5,
    onAlert: (report) => console.error('Health alert!', report),
  },

  diff: {
    onDiff: (result) => {
      if (result.hasCritical) console.error('Critical structure change!', result.changes);
    },
  },

  cache: { ttl: 3600 },
  cookies: true,
  rateLimit: { requestsPerSecond: 2 },
  proxies: ['http://user:pass@proxy1:8080', 'http://proxy2:8080'],
  proxyStrategy: 'sticky',

  webhook: {
    onComplete: 'https://your-api.com/scraping-done',
    onError:    'https://your-api.com/scraping-error',
  },

  validate: {
    name:  { required: true, type: 'string', minLength: 2 },
    price: { required: true, pattern: /^[拢$鈧琞[\d,.]+$/ },
  },
});

const data = await scraper.extract('/product/laptop-x', schema);
```

---

### `scraper.extract(url, schema, options)` {#scraperextract}

```js
const data = await scraper.extract('https://example.com', schema, {
  strict: true,
  responseType: 'auto',
  params: { page: 2, sort: 'newest' },
  request: {
    headers: { 'X-Custom': 'value' },
    method: 'GET',
    signal: controller.signal,
    rejectUnauthorized: true,
  },
});
```

**Options:**

| Key | Type | Default | Keterangan |
|---|---|---|---|
| `strict` | `boolean` | `false` | Throw `ValidationError` jika validasi gagal |
| `responseType` | `'auto'` \| `'html'` \| `'json'` | `'auto'` | Paksa mode ekstraksi, atau biarkan auto-detect dari `Content-Type` / body sniffing |
| `params` | `object` | 鈥� | Query params, di-merge ke URL otomatis |
| `request.headers` | `object` | `{}` | Header tambahan untuk request |
| `request.method` | `string` | `'GET'` | HTTP method |
| `request.body` | `string` | 鈥� | Request body (untuk POST/PUT) |
| `request.signal` | `AbortSignal` | 鈥� | Untuk cancel request di tengah jalan |
| `request.rejectUnauthorized` | `boolean` | `true` | Set `false` untuk terima self-signed cert (dev/internal only) |

---

### `scraper.batch(urls, schema, options)` {#scraperbatch}

```js
const results = await scraper.batch(urls, { name: 'h1', price: '.price' }, {
  concurrency: 3,
  delay: 800,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});

results.forEach(r => {
  if (r.error) console.error(`Failed: ${r.url}`, r.error.message);
  else console.log(r.url, r.data);
});
```

| Key | Type | Default | Keterangan |
|---|---|---|---|
| `concurrency` | `number` | `3` | Jumlah request paralel |
| `delay` | `number` | `800` | Base delay (ms) antar batch, di-jitter otomatis |
| `onProgress` | `function` | `null` | `(done, total) => void` |
| `strict` | `boolean` | `false` | Throw per-item jika validasi gagal |

Return: array `{ url, data, error }`.

---

### `scraper.paginate(startUrl, config, schema, options)` {#scraperpaginate}

```js
const items = await scraper.paginate(
  'https://books.toscrape.com/catalogue/page-1.html',
  { nextSelector: '.next a', itemsSelector: '.product_pod', maxPages: 10, delayBetweenPages: 1200 },
  { title: 'h3 a', price: '.price_color', rating: '.star-rating' },
);
```

| Key | Type | Default | Keterangan |
|---|---|---|---|
| `nextSelector` | `string` | 鈥� | **Required.** Selector link halaman berikutnya |
| `itemsSelector` | `string` | `null` | Selector container per item. Kosong = seluruh halaman jadi satu object |
| `maxPages` | `number` | `10` | Batas maksimal halaman |
| `delayBetweenPages` | `number` | `1200` | Jeda antar halaman (ms), di-jitter 卤20% |

---

### `scraper.login(url, formData, options)` {#scraperlogin}

POST form-urlencoded ke halaman login. Cookie session yang didapat otomatis tersimpan di Cookie Jar dan dipakai di semua request berikutnya.

```js
const ok = await scraper.login('https://example.com/login', {
  username: 'qrtz',
  password: 'secret',
});

if (ok) {
  const data = await scraper.extract('https://example.com/dashboard', {
    welcome: '.welcome-message',
  });
}
```

Return: `boolean` 鈥� `true` kalau status response < 400.

---

### `scraper.discover(origin, options)` {#scraperdiscover}

Temukan semua URL dari sebuah situs lewat `robots.txt` 鈫� `Sitemap:` 鈫� `sitemap.xml` (termasuk sitemap index bertingkat).

```js
const urls = await scraper.discover('https://example.com', {
  maxDepth: 2,
  maxEntries: 2000,
  pattern: /\/product\//,
});

const results = await scraper.batch(urls, schema);
```

| Key | Type | Default | Keterangan |
|---|---|---|---|
| `maxDepth` | `number` | `1` | Berapa level sitemap index yang di-follow |
| `maxEntries` | `number` | `5000` | Batas total URL yang dikumpulkan |
| `pattern` | `RegExp` | `null` | Filter URL yang masuk hasil akhir |

---

### `scraper.export(input, schema, options)` {#scraperexport}

Scrape lalu langsung export ke file 鈥� atau kalau `input` sudah berupa data hasil ekstraksi, langsung diserialisasi tanpa scrape ulang.

```js
await scraper.export('https://example.com/product/1', schema, {
  format: 'json',
  path: './output/product.json',
});

await scraper.export(urls, schema, {
  format: 'csv',
  path: './output/products.csv',
  concurrency: 5,
});

await scraper.export('https://example.com/catalog', schema, {
  pagination: { nextSelector: '.next', itemsSelector: '.item', maxPages: 20 },
  format: 'markdown',
  path: './output/catalog.md',
});

await sengkrep.exportData(alreadyExtractedArray, { format: 'ndjson', path: './output/dump.ndjson' });
```

`input` bisa berupa: satu URL (extract), array URL (batch), satu URL + `options.pagination` (paginate), atau array/object data yang sudah diekstrak sebelumnya (langsung diserialisasi).

| Format | Keterangan |
|---|---|
| `json` | Array of objects, pretty-printed |
| `csv` | Header otomatis dari union semua keys, quote-escaped |
| `ndjson` | Satu JSON object per baris, siap untuk streaming/RAG pipeline |
| `markdown` | Tabel markdown, siap tempel ke dokumentasi |

---

## Schema Syntax

### HTML Schema

Schema bisa ditulis dalam 3 bentuk:

```js
const shorthand = {
  title: 'h1',
  price: '.price',
};

const withArray = {
  tags:   ['.tag'],
  images: ['img.product-photo'],
};

const full = {
  title: {
    selector:  'h1.product-title',
    required:  true,
    type:      'text',
    transform: (val) => val.trim().toLowerCase(),
    default:   'Untitled',
  },
  price: {
    selector: '.price-tag',
    required: true,
    pattern:  /^[拢$鈧琞[\d,.]+$/,
  },
  images: {
    selector: 'img.gallery-photo',
    multiple: true,
    attr:     'src',
  },
  description: {
    selector: '.product-desc',
    type:     'html',
  },
};
```

**Field options:**

| Key | Type | Keterangan |
|---|---|---|
| `selector` | `string` | CSS selector |
| `required` | `boolean` | Throw `ExtractionError` jika kosong |
| `multiple` | `boolean` | Kumpulkan semua elemen jadi array |
| `attr` | `string` | Ambil attribute HTML, misal `'href'`, `'src'` |
| `type` | `'text'` \| `'html'` | `text` pakai `.text()`, `html` pakai `.html()` |
| `transform` | `function` | Post-process value: `(val) => newVal` |
| `pattern` | `RegExp` | Tandai health mismatch kalau value nggak cocok |
| `default` | `any` | Nilai default kalau kosong (field nggak required) |

### JSON Schema

Untuk situs yang datanya datang dari endpoint JSON API. Selector-nya berupa **path notation**, bukan CSS selector.

```js
const schema = {
  userName: 'data.user.name',
  titles:   'data.items[].title',
  firstTag: 'data.items[0].tags[0]',
  rating: {
    path:      'data.product.rating',
    required:  true,
    transform: (val) => parseFloat(val),
    default:   0,
  },
};

const data = await scraper.extract('https://api.example.com/product/1', schema, {
  responseType: 'json',
});
```

**Path syntax:**

| Sintaks | Arti |
|---|---|
| `a.b.c` | Akses object key bersarang |
| `a.b[0].c` | Akses index array tertentu |
| `a.b[].c` | Wildcard 鈥� map ke semua elemen array, hasil jadi array |
| `a.b[][0]` | Kombinasi: untuk setiap elemen array `b`, ambil index 0-nya |

Field dengan wildcard (`[]`) otomatis mengembalikan array. Field tanpa wildcard mengembalikan single value (elemen pertama yang ditemukan).

`responseType: 'auto'` (default) akan otomatis pakai JSON extractor kalau `Content-Type` response mengandung `application/json`, atau kalau body-nya diawali `{`/`[` walau Content-Type-nya nggak diset dengan benar.

---

## Modules

### Schema Validator

```js
const scraper = sengkrep.create({
  validate: {
    name:   { required: true, type: 'string', minLength: 3, maxLength: 200 },
    price:  { required: true, pattern: /^[拢$鈧琞[\d,.]+$/ },
    rating: { type: 'number', custom: (val) => (val >= 0 && val <= 5) ? true : 'Rating harus antara 0 dan 5' },
    tags:   { minItems: 1 },
    url:    { type: 'url' },
  },
});
```

| Rule | Type | Keterangan |
|---|---|---|
| `required` | `boolean` | Field tidak boleh null/empty |
| `type` | `string` | `'string'`, `'number'`, `'boolean'`, `'url'`, `'email'`, `'date'` |
| `pattern` | `RegExp` | Value harus match regex |
| `minLength` / `maxLength` | `number` | Panjang string (warning, bukan error) |
| `minItems` | `number` | Minimum item untuk array (warning) |
| `notEmpty` | `boolean` | Value tidak boleh string kosong/whitespace |
| `custom` | `function` | `(value, allData) => true \| 'pesan error'` |

Akses hasil: `data._ryna.validation.{valid, errors, warnings}`. Pakai `{ strict: true }` di `extract()` untuk langsung throw.

---

### Selector Health Monitor

Melacak histori tiap selector per URL dalam sliding window. Alert kalau empty-rate atau count-drop melewati threshold.

```js
const scraper = sengkrep.create({
  health: {
    alertThreshold: 0.5,
    windowSize: 15,
    onAlert: ({ url, alerts }) => alerts.forEach(a => console.error(`[HEALTH] ${a.message}`)),
  },
});
```

| Alert type | Keterangan |
|---|---|
| `high_empty_rate` | Selector sering return kosong |
| `count_drop` | Jumlah item turun drastis dari rata-rata |
| `pattern_mismatch` | Value nggak cocok pattern di schema |

API manual: `scraper.health.getReport(url)`, `.getAllReports()`, `.reset(url?)`.

---

### Smart Retry

```js
const scraper = sengkrep.create({
  retry: {
    max: 4,
    jitter: true,
    retryOn: [408, 429, 500, 502, 503, 504, 403],
    retryOnNetwork: true,
    retryOnTimeout: true,
    onRetry: ({ attempt, status, code, waitMs }) => console.log(`Retry #${attempt} | ${status ?? code} | wait ${waitMs}ms`),
  },
});
```

**Delay strategy per status code:**

| Status | Base Delay | Multiplier | Max Delay |
|---|---|---|---|
| `429` | 5000ms | 脳2.0 | 120s |
| `403` | 8000ms | 脳2.0 | 60s |
| `503` | 3000ms | 脳1.5 | 30s |
| `502`, `504` | 2000ms | 脳1.5 | 20s |
| `500` | 1500ms | 脳1.5 | 15s |
| `408` | 1000ms | 脳1.2 | 10s |
| Default | 1000ms | 脳1.5 | 15s |

Setiap delay dikali faktor jitter random. Request yang di-cancel lewat `AbortSignal` (`CanceledError`) **tidak pernah** di-retry, apapun konfigurasinya.

---

### Request Fingerprint

```js
const scraper = sengkrep.create({
  fingerprint: {
    userAgent: 'random',
    rotateUAOnEachRequest: true,
    randomizeHeaderOrder: true,
    randomizeTiming: true,
  },
  delay: 1500,
  delayMin: 800,
  delayMax: 3500,
});
```

| Elemen | Detail |
|---|---|
| `User-Agent` | Pool 10 UA realistis (Chrome, Firefox, Safari, Edge, Linux) |
| `Accept-Language` | Rotasi dari 6 kombinasi bahasa |
| `Accept-Encoding` | Variasi `gzip,deflate,br` |
| `Sec-CH-UA` / `Sec-CH-UA-Platform` | Auto-generate sesuai UA terpilih |
| **Header order** | Shuffle pakai Fisher-Yates |
| **Timing** | Jitter 卤30% dari base delay |

---

### Diff Detector

```js
const scraper = sengkrep.create({
  diff: {
    storageDir: '.ryna-snapshots',
    sensitivity: 'structural',
    onDiff: (result) => {
      if (result.hasCritical) sendAlert('Scraper structure changed!', result.changes);
    },
  },
});
```

| Change type | Severity | Keterangan |
|---|---|---|
| `type_changed` | 馃敶 critical | Tipe data berubah (object 鈫� array) |
| `keys_removed` | 馃敶 critical | Key yang sebelumnya ada sekarang hilang |
| `item_schema_changed` | 馃敶 critical | Keys dalam array item berubah |
| `fields_became_null` | 馃煛 warn | Field yang sebelumnya ada data kini null |
| `count_changed` | 馃煛 warn | Jumlah item array berubah drastis (鈮�50%) |
| `keys_added` | 馃煝 info | Key baru muncul |
| `fields_recovered` | 馃煝 info | Field yang sebelumnya null kini ada data |
| `value_changed` | 馃煝 info | Nilai berubah (hanya saat `sensitivity: 'value'`) |

API manual: `scraper.diff.clearSnapshot(url)`, `.clearAll()`.

---

### Smart Cache

TTL-based cache di level HTTP response 鈥� skip network kalau masih fresh, tapi tetap jalanin extraction/health/diff/validation di setiap call (jadi metadata tetap akurat).

```js
const scraper = sengkrep.create({
  cache: {
    ttl: 3600,
    storage: 'memory',
    maxItems: 1000,
  },
});

const first  = await scraper.extract(url, schema);
const second = await scraper.extract(url, schema);

console.log(first._ryna.cache.hit);
console.log(second._ryna.cache.hit);
```

| Key | Type | Default | Keterangan |
|---|---|---|---|
| `ttl` | `number` | `3600` | Detik sebelum entry kadaluarsa |
| `storage` | `'memory'` \| `'disk'` | `'memory'` | `disk` persist lintas restart proses |
| `storageDir` | `string` | `.sengkrep-ryna-cache` | Lokasi penyimpanan kalau `storage: 'disk'` |
| `maxItems` | `number` | `1000` | Batas entry di memory (LRU-ish eviction) |

API manual: `scraper.cache.stats()` 鈫� `{ hits, misses, sets, size, hitRate }`.

---

### Cookie Jar & Sessions

Aktif secara default (`cookies: true`). Cookie dari `Set-Cookie` otomatis ditangkap dan dikirim ulang ke request berikutnya yang ke domain yang sama 鈥� termasuk subdomain.

```js
const scraper = sengkrep.create({ cookies: true });

await scraper.login('https://example.com/login', { user: 'qrtz', pass: 'secret' });
const dashboard = await scraper.extract('https://example.com/dashboard', schema);
```

Matiin kalau nggak perlu (request jadi sedikit lebih cepat): `sengkrep.create({ cookies: false })`.

API manual: `scraper.cookieJar.getAll(hostname)`, `.export()`, `.import(snapshot)`, `.clear(hostname?)` 鈥� `export()`/`import()` berguna buat nyimpen session ke disk antar proses.

---

### Proxy Rotation

CONNECT tunnel buat HTTPS dan forward proxy buat HTTP 鈥� keduanya diimplementasi native pakai `net`/`tls`/`http`/`https`, **tanpa dependency tambahan** kayak `https-proxy-agent`.

```js
const scraper = sengkrep.create({
  proxies: [
    'http://user:pass@proxy1.example.com:8080',
    'http://proxy2.example.com:8080',
    'http://proxy3.example.com:8080',
  ],
  proxyStrategy: 'sticky',
  proxyMaxFailures: 3,
});
```

| Strategy | Keterangan |
|---|---|
| `round-robin` | Gilir satu-satu sesuai urutan |
| `random` | Pilih acak tiap request |
| `sticky` | Domain yang sama selalu dapet proxy yang sama (konsisten per-site) |

Proxy yang gagal berturut-turut (`proxyMaxFailures`, default 3) otomatis ditandai unhealthy dan dihindari sampai proxy lain juga gagal. Sukses me-reset hitungan failure-nya.

API manual: `scraper.proxyRotator.stats()` 鈫� `[{ proxy, failures, healthy }]`.

---

### Rate Limiter

Cegah satu domain di-hammer, terpisah per hostname (jadi domain lain nggak ikut melambat).

```js
const scraper = sengkrep.create({
  rateLimit: {
    requestsPerSecond: 2,
    concurrency: 3,
  },
});
```

| Key | Type | Keterangan |
|---|---|---|
| `requestsPerSecond` | `number` | Jarak minimum antar request ke hostname yang sama |
| `concurrency` | `number` | Maksimal request simultan ke hostname yang sama |

Kombinasi keduanya bisa dipakai sekaligus. Default: disabled (`undefined`/`null`, nggak ada limit).

---

### Interceptors

Axios-style middleware, selalu tersedia di `scraper.interceptors` 鈥� nggak perlu config khusus buat enable.

```js
scraper.interceptors.request.use((config) => {
  config.headers['X-Custom-Header'] = 'my-value';
  console.log(`鉃★笍 Request ke: ${config.url}`);
  return config;
});

scraper.interceptors.response.use((response) => {
  response.body = response.body.replace(/&nbsp;/g, ' ');
  return response;
}, (error) => {
  if (error.status === 404) {
    console.log('鈿狅笍 Page not found, skipping...');
    return { status: 404, body: '', headers: {}, skipped: true };
  }
  throw error;
});
```

`request.use(onFulfilled)` jalan sebelum request dikirim 鈥� terima dan return objek `{ url, method, headers, body, proxy, signal, timeout }`.

`response.use(onFulfilled, onRejected)` jalan setelah response diterima (atau gagal). `onRejected` bisa **recover** dari error dengan return value baru (bukan throw), persis kayak contoh 404-skip di atas.

`use()` return ID yang bisa dipakai buat `eject(id)` kalau interceptor-nya mau dicabut.

---

### Sitemap Discovery

```js
const urls = await scraper.discover('https://example.com', {
  maxDepth: 2,
  pattern: /\/blog\//,
});
```

Alurnya: fetch `robots.txt` 鈫� cari baris `Sitemap:` 鈫� kalau nggak ketemu, fallback ke `/sitemap.xml` 鈫� parse `<urlset>` atau `<sitemapindex>` (rekursif sampai `maxDepth`) 鈫� kumpulin semua `<loc>`.

---

### Multi-format Export

```js
const { toCSV, toJSON, toNDJSON, toMarkdownTable, exportData } = require('sengkrep-ryna');

const csv = toCSV(data);
const md  = toMarkdownTable(data);

exportData(data, { format: 'ndjson', path: './output/dump.ndjson' });
```

Bisa dipakai langsung (`scraper.export(...)`) atau lewat fungsi util standalone kalau data udah ada di tangan.

---

### Webhook Notifications

```js
const scraper = sengkrep.create({
  webhook: {
    onStart:    'https://your-api.com/scraping-start',
    onComplete: 'https://your-api.com/scraping-done',
    onError:    'https://your-api.com/scraping-error',
    onProgress: 'https://your-api.com/scraping-progress',
  },
});
```

Fire-and-forget POST JSON `{ event, timestamp, ...payload }` ke endpoint yang dikonfigurasi. Gagal kirim webhook nggak akan bikin scraping job-nya ikut gagal.

---

## Configuration Reference

```js
const scraper = sengkrep.create({
  logLevel: 'info',
  logPretty: true,
  baseURL: 'https://api.example.com',

  timeout: 30000,
  maxRedirects: 5,

  delay: 1000,
  delayMin: 600,
  delayMax: 3000,

  responseType: 'auto',
  cookies: true,

  fingerprint: {
    userAgent: 'random',
    rotateUAOnEachRequest: true,
    randomizeHeaderOrder: true,
    randomizeTiming: true,
  },

  retry: {
    max: 3,
    jitter: true,
    retryOn: [408, 429, 500, 502, 503, 504, 403],
    retryOnNetwork: true,
    retryOnTimeout: true,
    onRetry: ({ attempt, status, code, waitMs }) => {},
  },

  health: {
    alertThreshold: 0.5,
    windowSize: 10,
    onAlert: ({ url, alerts }) => {},
  },

  diff: {
    storageDir: '.sengkrep-ryna',
    sensitivity: 'structural',
    onDiff: (result) => {},
  },

  cache: {
    ttl: 3600,
    storage: 'memory',
    maxItems: 1000,
  },

  rateLimit: {
    requestsPerSecond: null,
    concurrency: null,
  },

  proxies: [],
  proxyStrategy: 'round-robin',
  proxyMaxFailures: 3,

  webhook: {
    onStart: null,
    onComplete: null,
    onError: null,
    onProgress: null,
  },

  validate: {
    fieldName: {
      required: false,
      type: 'string',
      pattern: /regex/,
      minLength: 0,
      maxLength: Infinity,
      minItems: 0,
      notEmpty: false,
      custom: (val, allData) => true,
    },
  },
});
```

---

## Error Handling

```js
const { errors } = require('sengkrep-ryna');
const {
  FetchError, TimeoutError, CanceledError, ProxyError,
  ExtractionError, JsonExtractionError, ValidationError,
} = errors;

try {
  await scraper.extract(url, schema, { strict: true });
} catch (err) {
  if (err instanceof TimeoutError) console.log('Request timeout');
  if (err instanceof CanceledError) console.log('Dibatalkan via AbortController');
  if (err instanceof ProxyError) console.log('Proxy gagal connect/tunnel:', err.message);
  if (err instanceof FetchError) console.log('status:', err.status, 'code:', err.code);
  if (err instanceof ExtractionError) console.log('Required field kosong:', err.field, err.selector);
  if (err instanceof JsonExtractionError) console.log('Path JSON nggak ketemu:', err.field, err.path);
  if (err instanceof ValidationError) err.errors.forEach(e => console.log(e.field, e.message));
}
```

**FetchError codes:**

| Code | Keterangan |
|---|---|
| `HTTP_ERROR` | Server return status 鈮� 400 |
| `NETWORK_ERROR` | Koneksi gagal |
| `TIMEOUT` | Request melebihi timeout (`TimeoutError`) |
| `CANCELED` | Dibatalkan lewat `AbortSignal` (`CanceledError`) |
| `PROXY_ERROR` | Proxy CONNECT/tunnel gagal (`ProxyError`) |
| `TOO_MANY_REDIRECTS` | Redirect loop atau melebihi `maxRedirects` |
| `INVALID_URL` | URL tidak valid |
| `DECOMPRESS_ERROR` | Gagal decompress response body |

---

## Accessing Meta (`_ryna`)

Hasil semua modul tersimpan di property `_ryna` yang **non-enumerable** 鈥� tidak muncul saat `console.log`/`JSON.stringify`, tapi bisa diakses langsung.

```js
const data = await scraper.extract(url, schema);

console.log(data);

const meta = data._ryna;

meta.responseType;
meta.cache?.hit;
meta.health?.alerts;
meta.diff?.changes;
meta.validation?.errors;
meta.validation?.warnings;
```

---

## Testing

Library ini punya test suite sendiri (78 test) yang jalan 100% lokal 鈥� nggak butuh akses internet sama sekali. Cocok dites di Termux/CI/offline.

```bash
npm test
```

Yang dites: HTTP fetch (redirect, gzip, timeout, abort), proxy CONNECT tunnel via local forward-proxy + self-signed HTTPS server, cookie roundtrip, retry backoff terhadap endpoint yang sengaja dibikin flaky, cache TTL/eviction, rate limiter timing, proxy rotator strategy, JSON path extraction, schema validation, health monitor alerting, diff detection, fingerprint randomization, webhook delivery, dan export ke semua format 鈥� plus integration test end-to-end lewat `Ryna.extract/batch/paginate/login/discover/export`.

Kalau `openssl` nggak ketemu di environment lo, test yang butuh HTTPS-via-proxy otomatis di-skip (bukan fail) 鈥� sisanya tetap jalan penuh.

---

## Examples

### E-commerce dengan full reliability + proxy + cache

```js
const sengkrep = require('sengkrep-ryna');

const scraper = sengkrep.create({
  logLevel: 'info',
  cache: { ttl: 1800 },
  proxies: ['http://proxy1:8080', 'http://proxy2:8080'],
  proxyStrategy: 'sticky',
  rateLimit: { requestsPerSecond: 2 },
  fingerprint: { userAgent: 'random', rotateUAOnEachRequest: true },
  retry: { max: 3, retryOn: [429, 500, 502, 503] },

  health: {
    alertThreshold: 0.4,
    onAlert: ({ url, alerts }) => alerts.forEach(a => console.error(`[HEALTH] ${url}: ${a.message}`)),
  },

  diff: {
    onDiff: ({ url, changes, hasCritical }) => {
      if (hasCritical) console.error(`[DIFF] Critical changes at ${url}!`);
    },
  },

  validate: {
    name:   { required: true, minLength: 2 },
    price:  { required: true, pattern: /^Rp[\d.,]+$/ },
    rating: { type: 'number' },
  },
});

const product = await scraper.extract('https://example-store.com/product/laptop-x', {
  name:   'h1.product-name',
  price:  '.price-display',
  rating: '.rating-value',
  stock:  '.stock-status',
  images: ['img.product-gallery'],
});
```

### Situs login-walled

```js
const scraper = sengkrep.create({ cookies: true, logLevel: 'info' });

const loggedIn = await scraper.login('https://example.com/login', {
  username: 'qrtz',
  password: process.env.SCRAPE_PASSWORD,
});

if (!loggedIn) throw new Error('Login gagal, cek kredensial');

const orders = await scraper.paginate(
  'https://example.com/account/orders?page=1',
  { nextSelector: '.pagination-next', itemsSelector: '.order-row', maxPages: 50 },
  { orderId: '.order-id', total: '.order-total', status: '.order-status' },
);
```

### JSON API scraping (situs yang data-nya dari XHR/fetch)

```js
const scraper = sengkrep.create({ logLevel: 'info' });

const data = await scraper.extract('https://example.com/api/v2/products?page=1', {
  products: 'data.products[].name',
  prices:   'data.products[].price.amount',
  total:    'meta.total_count',
}, { responseType: 'json' });

console.log(data.products.length, 'produk,', data.total, 'total');
```

### Full-site crawl pakai sitemap discovery + export

```js
const scraper = sengkrep.create({
  rateLimit: { requestsPerSecond: 3 },
  cache: { ttl: 3600 },
});

const urls = await scraper.discover('https://example-blog.com', { pattern: /\/post\// });

await scraper.export(urls, {
  title:   'h1',
  content: { selector: '.post-content', type: 'html' },
  author:  '.author-name',
  date:    'time[datetime]',
}, {
  format: 'markdown',
  path: './output/all-posts.md',
  concurrency: 5,
});
```

### News batch scraper dengan diff detection + webhook

```js
const scraper = sengkrep.create({
  diff: {
    sensitivity: 'value',
    onDiff: ({ url, changes }) => {
      if (changes.some(c => c.type === 'value_changed')) console.log(`Article updated: ${url}`);
    },
  },
  webhook: { onError: 'https://your-api.com/scraping-error' },
  retry: { max: 2 },
  delay: 600,
});

const results = await scraper.batch(articleUrls, {
  headline: 'h1.article-title',
  author:   '.byline-name',
  date:     'time[datetime]',
  content:  { selector: '.article-body', type: 'html' },
}, {
  concurrency: 2,
  delay: 1000,
  onProgress: (done, total) => process.stdout.write(`\r${done}/${total}`),
});
```

### Pakai modul standalone tanpa Ryna instance

```js
const { Fingerprint, HealthMonitor, DiffDetector, SchemaValidator, ProxyRotator, JsonExtractor } = require('sengkrep-ryna');

const fp      = new Fingerprint({ userAgent: 'random' });
const headers = fp.buildHeaders({ 'X-Forwarded-For': '8.8.8.8' });

const monitor = new HealthMonitor({ alertThreshold: 0.4 });
monitor.record('https://example.com', {
  title: { selector: 'h1', empty: false, count: 1 },
  price: { selector: '.price', empty: true, count: 0 },
});

const rotator = new ProxyRotator({ proxies: ['http://p1:8080', 'http://p2:8080'], strategy: 'random' });
const proxy   = rotator.next('example.com');

const je = new JsonExtractor();
const { data } = je.extract({ items: [{ n: 1 }, { n: 2 }] }, { values: 'items[].n' });
```

---

## Architecture

```
sengkrep-ryna/
鈹溾攢鈹� index.js                    Entry point + convenience API
鈹溾攢鈹� example.js                  Runnable quick-start demo
鈹溾攢鈹� test/
鈹�   鈹溾攢鈹� server.js                Local HTTP/HTTPS/proxy fixtures (zero external network)
鈹�   鈹溾攢鈹� run.js                   Unit tests 鈥� module-level
鈹�   鈹斺攢鈹� integration.js           Integration tests 鈥� full Ryna orchestration
鈹斺攢鈹� src/
    鈹溾攢鈹� Ryna.js                  Orchestrator utama
    鈹溾攢鈹� core/
    鈹�   鈹溾攢鈹� Fetcher.js            HTTP client (proxy, cookies, abort, interceptors, decompress)
    鈹�   鈹溾攢鈹� ProxyTunnel.js        CONNECT tunnel native (zero dependency)
    鈹�   鈹溾攢鈹� Extractor.js          HTML extraction engine (cheerio)
    鈹�   鈹溾攢鈹� JsonExtractor.js      JSON path extraction engine
    鈹�   鈹斺攢鈹� Retry.js              Adaptive retry per-status strategy
    鈹斺攢鈹� modules/
        鈹溾攢鈹� Fingerprint.js        UA rotation, header randomization, timing jitter
        鈹溾攢鈹� SchemaValidator.js    Validasi data hasil ekstraksi
        鈹溾攢鈹� HealthMonitor.js      Selector health tracking
        鈹溾攢鈹� DiffDetector.js       Structural diff detection
        鈹溾攢鈹� Cache.js              TTL response cache
        鈹溾攢鈹� CookieJar.js          Session/cookie persistence
        鈹溾攢鈹� ProxyRotator.js       Proxy pool strategy + health tracking
        鈹溾攢鈹� RateLimiter.js        Per-hostname token bucket
        鈹溾攢鈹� Interceptors.js       Request/response middleware chain
        鈹溾攢鈹� Discover.js           Sitemap + robots.txt crawler
        鈹斺攢鈹� Webhook.js            Lifecycle event notifier
    鈹斺攢鈹� utils/
        鈹溾攢鈹� logger.js              Colored leveled logger
        鈹溾攢鈹� storage.js             JSON file storage (DiffDetector + disk Cache)
        鈹斺攢鈹� exporter.js            CSV/JSON/NDJSON/Markdown writers
```

**Request flow:**

```
scraper.extract(url, schema)
  鈹斺攢鈹� _resolveUrl (baseURL) + _applyParams (query string)
  鈹斺攢鈹� Cache.get() 鈫� HIT? return cached response
  鈹斺攢鈹� Retry.run()
      鈹斺攢鈹� RateLimiter.acquire(hostname)
      鈹斺攢鈹� ProxyRotator.next(hostname)
      鈹斺攢鈹� Fetcher.fetch()
          鈹斺攢鈹� Interceptors.request.run(config)
          鈹斺攢鈹� Fingerprint.buildHeaders()
          鈹斺攢鈹� CookieJar.getCookieHeader() / setFromHeaders()
          鈹斺攢鈹� ProxyTunnel (CONNECT for https, forward route for http)
          鈹斺攢鈹� Decompress response (gzip/br/deflate)
          鈹斺攢鈹� Interceptors.response.run(raw) / runError(err)
  鈹斺攢鈹� Cache.set()
  鈹斺攢鈹� _looksLikeJson() 鈫� Extractor (cheerio) atau JsonExtractor (path)
  鈹斺攢鈹� HealthMonitor.record()
  鈹斺攢鈹� DiffDetector.check()
  鈹斺攢鈹� SchemaValidator.validate()
  鈹斺攢鈹� Webhook.fire('onComplete' | 'onError')
  鈹斺攢鈹� Return { ...data, _ryna: { cache, responseType, health, diff, validation } }
```

---

## Tips & Troubleshooting

**Selector return null padahal di browser ada datanya** 鈥� kemungkinan besar situsnya render via JavaScript (client-side rendering). `sengkrep-ryna` cuma parsing HTML mentah, nggak menjalankan JS. Cek `view-source:` di browser; kalau datanya nggak ada di situ, coba cari endpoint JSON internal-nya lewat tab Network di DevTools dan pakai `responseType: 'json'` dengan `JsonExtractor` 鈥� biasanya lebih stabil daripada scraping HTML yang di-render JS sekalipun pakai headless browser.

**Proxy auth gagal terus** 鈥� format URL proxy yang didukung: `http://user:pass@host:port`. Pastikan username/password di-`encodeURIComponent` kalau mengandung karakter spesial (`@`, `:`, `/`).

**`rejectUnauthorized: false` itu buat apa** 鈥� cuma buat proxy/target dengan self-signed certificate (internal tools, dev environment). Jangan dipakai ke situs publik di production, itu menghilangkan validasi certificate sepenuhnya.

**Cache nggak ke-invalidate pas saya butuh data fresh** 鈥� panggil `scraper.cache.delete(url)` atau `scraper.cache.clear()` sebelum extract, atau set `ttl` lebih pendek untuk data yang sering berubah.

**Health monitor / diff detector kelihatan "noisy" di awal** 鈥� wajar, butuh beberapa run dulu (`windowSize`) buat punya baseline yang reliable. First run selalu `firstRun: true` tanpa alert.

---

## License

MIT 漏 rynaqrtz
