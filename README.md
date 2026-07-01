<div align="center">

<a href="https://i.postimg.cc/0jSV8SX3/sengkrep-ryna.webp">
  <img src="https://i.postimg.cc/0jSV8SX3/sengkrep-ryna.webp" alt="sengkrep-ryna" width="100%" />
</a>

<br /><br />

<h1>sengkrep-ryna</h1>

<p align="center">
  <strong>Scraping reliability layer untuk Node.js.</strong><br />
  Schema validation · Selector health monitor · Smart retry · Fingerprint randomizer · Diff detector<br />
  Smart cache · Cookie sessions · Proxy rotation · Rate limiter · Interceptors · JSON API extraction · Sitemap discovery
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sengkrep-ryna">
    <img src="https://img.shields.io/npm/v/sengkrep-ryna?color=black&style=flat-square" alt="npm version">
  </a>
  <a href="https://nodejs.org">
    <img src="https://img.shields.io/node/v/sengkrep-ryna?color=black&style=flat-square" alt="node version">
  </a>
  <a href="https://www.npmjs.com/package/sengkrep-ryna?activeTab=dependencies">
    <img src="https://img.shields.io/badge/dependencies-1-black?style=flat-square" alt="dependencies">
  </a>
  <a href="https://www.npmjs.com/package/sengkrep-ryna">
    <img src="https://img.shields.io/badge/tests-78%20passing-black?style=flat-square" alt="tests">
  </a>
</p>

---

## v2.0.0 — Major Upgrade

v1 adalah reliability layer. v2 adalah itu plus toolkit lengkap buat ngehandle masalah-masalah yang baru muncul setelah scraper lo jalan lama: session/login, IP block, rate limit, dan ekstraksi dari JSON API (bukan cuma HTML). Semua ditambahin **tanpa nambah dependency baru** — masih cuma `cheerio`.

| Fitur | v1.0.0 | v2.0.0 |
|---|---|---|
| Schema Validator | ✅ | ✅ |
| Selector Health Monitor | ✅ | ✅ |
| Smart Retry (adaptive backoff + jitter) | ✅ | ✅ + never retries canceled requests |
| Request Fingerprint Randomizer | ✅ | ✅ |
| Diff Detector | ✅ | ✅ |
| Smart Cache (TTL, memory/disk) | ❌ | ✅ **BARU** |
| Cookie Jar + Session Login | ❌ | ✅ **BARU** |
| Proxy Rotation (round-robin/random/sticky + health tracking) | ❌ | ✅ **BARU** |
| Per-domain Rate Limiter | ❌ | ✅ **BARU** |
| Interceptors (request/response middleware) | ❌ | ✅ **BARU** |
| Cancel Request (AbortController) | ❌ | ✅ **BARU** |
| TimeoutError vs CanceledError (distinct classes) | ❌ | ✅ **BARU** |
| JSON API Extraction (schema-based, bukan cuma HTML) | ❌ | ✅ **BARU** |
| Auto-detect HTML vs JSON response | ❌ | ✅ **BARU** |
| Sitemap + robots.txt Discovery | ❌ | ✅ **BARU** |
| Multi-format Export (csv/json/ndjson/markdown) | ❌ | ✅ **BARU** |
| Webhook Notifications | ❌ | ✅ **BARU** |
| baseURL + auto query params | ❌ | ✅ **BARU** |
| rejectUnauthorized override (self-signed/dev cert) | ❌ | ✅ **BARU** |
| Local test suite (zero network dependency) | ❌ | ✅ **BARU**, 78 test |
| Dependencies | 1 (cheerio) | 1 (cheerio) |

---

## Kenapa sengkrep-ryna?

Library scraping biasanya fokus ke *gimana cara ambil data*. `sengkrep-ryna` fokus ke masalah yang datang setelah itu — dan sekarang juga ke masalah yang datang **sebelum** itu (akses, sesi, IP block).

Masalah nyata yang sering terjadi:

- Selector berubah diam-diam karena website deploy ulang — nggak ada yang alert
- Data yang dihasilkan pass validation tapi strukturnya sudah beda dari kemarin
- Rate limit kena, scraper mati, dan retry langsung hammer server makin cepat
- Request pattern terlalu robotic — UA sama, header urutan sama, timing sama — langsung diblokir
- Situs butuh login dulu sebelum data bisa diakses, dan session-nya hilang tiap request baru
- Satu IP kena ban permanen karena nggak ada rotasi
- Banyak situs modern nggak render data di HTML — data-nya datang dari endpoint JSON internal yang dipanggil via `fetch()`/XHR di belakang layar
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

Satu-satunya dependency eksternal: cheerio untuk HTML parsing. Semua fitur lain (proxy tunnel, cookie jar, cache, rate limiter, dst) dibangun di atas built-in Node.js modules saja.

---

Quick Start

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

Table of Contents

· Core API
  · sengkrep(url, schema, options)
  · sengkrep.create(options)
  · scraper.extract(url, schema, options)
  · scraper.batch(urls, schema, options)
  · scraper.paginate(startUrl, config, schema, options)
  · scraper.login(url, formData, options)
  · scraper.discover(origin, options)
  · scraper.export(input, schema, options)
· Schema Syntax
  · HTML Schema
  · JSON Schema
· Modules
  · Schema Validator
  · Selector Health Monitor
  · Smart Retry
  · Request Fingerprint
  · Diff Detector
  · Smart Cache
  · Cookie Jar & Sessions
  · Proxy Rotation
  · Rate Limiter
  · Interceptors
  · Sitemap Discovery
  · Multi-format Export
  · Webhook Notifications
· Configuration Reference
· Error Handling
· Accessing Meta (_ryna)
· Testing
· Examples
· Architecture
· Tips & Troubleshooting
· License

---

Core API

sengkrep(url, schema, options)

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

sengkrep.create(options)

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
    price: { required: true, pattern: /^[£$€][\d,.]+$/ },
  },
});

const data = await scraper.extract('/product/laptop-x', schema);
```

---

scraper.extract(url, schema, options) {#scraperextract}

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

Options:

Key Type Default Keterangan
strict boolean false Throw ValidationError jika validasi gagal
responseType 'auto' \| 'html' \| 'json' 'auto' Paksa mode ekstraksi, atau biarkan auto-detect dari Content-Type / body sniffing
params object — Query params, di-merge ke URL otomatis
request.headers object {} Header tambahan untuk request
request.method string 'GET' HTTP method
request.body string — Request body (untuk POST/PUT)
request.signal AbortSignal — Untuk cancel request di tengah jalan
request.rejectUnauthorized boolean true Set false untuk terima self-signed cert (dev/internal only)

---

scraper.batch(urls, schema, options) {#scraperbatch}

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

Key Type Default Keterangan
concurrency number 3 Jumlah request paralel
delay number 800 Base delay (ms) antar batch, di-jitter otomatis
onProgress function null (done, total) => void
strict boolean false Throw per-item jika validasi gagal

Return: array { url, data, error }.

---

scraper.paginate(startUrl, config, schema, options) {#scraperpaginate}

```js
const items = await scraper.paginate(
  'https://books.toscrape.com/catalogue/page-1.html',
  { nextSelector: '.next a', itemsSelector: '.product_pod', maxPages: 10, delayBetweenPages: 1200 },
  { title: 'h3 a', price: '.price_color', rating: '.star-rating' },
);
```

Key Type Default Keterangan
nextSelector string — Required. Selector link halaman berikutnya
itemsSelector string null Selector container per item. Kosong = seluruh halaman jadi satu object
maxPages number 10 Batas maksimal halaman
delayBetweenPages number 1200 Jeda antar halaman (ms), di-jitter ±20%

---

scraper.login(url, formData, options) {#scraperlogin}

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

Return: boolean — true kalau status response < 400.

---

scraper.discover(origin, options) {#scraperdiscover}

Temukan semua URL dari sebuah situs lewat robots.txt → Sitemap: → sitemap.xml (termasuk sitemap index bertingkat).

```js
const urls = await scraper.discover('https://example.com', {
  maxDepth: 2,
  maxEntries: 2000,
  pattern: /\/product\//,
});

const results = await scraper.batch(urls, schema);
```

Key Type Default Keterangan
maxDepth number 1 Berapa level sitemap index yang di-follow
maxEntries number 5000 Batas total URL yang dikumpulkan
pattern RegExp null Filter URL yang masuk hasil akhir

---

scraper.export(input, schema, options) {#scraperexport}

Scrape lalu langsung export ke file — atau kalau input sudah berupa data hasil ekstraksi, langsung diserialisasi tanpa scrape ulang.

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

input bisa berupa: satu URL (extract), array URL (batch), satu URL + options.pagination (paginate), atau array/object data yang sudah diekstrak sebelumnya (langsung diserialisasi).

Format Keterangan
json Array of objects, pretty-printed
csv Header otomatis dari union semua keys, quote-escaped
ndjson Satu JSON object per baris, siap untuk streaming/RAG pipeline
markdown Tabel markdown, siap tempel ke dokumentasi

---

Schema Syntax

HTML Schema

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
    pattern:  /^[£$€][\d,.]+$/,
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

Field options:

Key Type Keterangan
selector string CSS selector
required boolean Throw ExtractionError jika kosong
multiple boolean Kumpulkan semua elemen jadi array
attr string Ambil attribute HTML, misal 'href', 'src'
type 'text' \| 'html' text pakai .text(), html pakai .html()
transform function Post-process value: (val) => newVal
pattern RegExp Tandai health mismatch kalau value nggak cocok
default any Nilai default kalau kosong (field nggak required)

JSON Schema

Untuk situs yang datanya datang dari endpoint JSON API. Selector-nya berupa path notation, bukan CSS selector.

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

Path syntax:

Sintaks Arti
a.b.c Akses object key bersarang
a.b[0].c Akses index array tertentu
a.b[].c Wildcard — map ke semua elemen array, hasil jadi array
a.b[][0] Kombinasi: untuk setiap elemen array b, ambil index 0-nya

Field dengan wildcard ([]) otomatis mengembalikan array. Field tanpa wildcard mengembalikan single value (elemen pertama yang ditemukan).

responseType: 'auto' (default) akan otomatis pakai JSON extractor kalau Content-Type response mengandung application/json, atau kalau body-nya diawali {/[ walau Content-Type-nya nggak diset dengan benar.

---

Modules

Schema Validator

```js
const scraper = sengkrep.create({
  validate: {
    name:   { required: true, type: 'string', minLength: 3, maxLength: 200 },
    price:  { required: true, pattern: /^[£$€][\d,.]+$/ },
    rating: { type: 'number', custom: (val) => (val >= 0 && val <= 5) ? true : 'Rating harus antara 0 dan 5' },
    tags:   { minItems: 1 },
    url:    { type: 'url' },
  },
});
```

Rule Type Keterangan
required boolean Field tidak boleh null/empty
type string 'string', 'number', 'boolean', 'url', 'email', 'date'
pattern RegExp Value harus match regex
minLength / maxLength number Panjang string (warning, bukan error)
minItems number Minimum item untuk array (warning)
notEmpty boolean Value tidak boleh string kosong/whitespace
custom function (value, allData) => true \| 'pesan error'

Akses hasil: data._ryna.validation.{valid, errors, warnings}. Pakai { strict: true } di extract() untuk langsung throw.

---

Selector Health Monitor

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

Alert type Keterangan
high_empty_rate Selector sering return kosong
count_drop Jumlah item turun drastis dari rata-rata
pattern_mismatch Value nggak cocok pattern di schema

API manual: scraper.health.getReport(url), .getAllReports(), .reset(url?).

---

Smart Retry

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

Delay strategy per status code:

Status Base Delay Multiplier Max Delay
429 5000ms ×2.0 120s
403 8000ms ×2.0 60s
503 3000ms ×1.5 30s
502, 504 2000ms ×1.5 20s
500 1500ms ×1.5 15s
408 1000ms ×1.2 10s
Default 1000ms ×1.5 15s

Setiap delay dikali faktor jitter random. Request yang di-cancel lewat AbortSignal (CanceledError) tidak pernah di-retry, apapun konfigurasinya.

---

Request Fingerprint

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

Elemen Detail
User-Agent Pool 10 UA realistis (Chrome, Firefox, Safari, Edge, Linux)
Accept-Language Rotasi dari 6 kombinasi bahasa
Accept-Encoding Variasi gzip,deflate,br
Sec-CH-UA / Sec-CH-UA-Platform Auto-generate sesuai UA terpilih
Header order Shuffle pakai Fisher-Yates
Timing Jitter ±30% dari base delay

---

Diff Detector

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

Change type Severity Keterangan
type_changed 🔴 critical Tipe data berubah (object → array)
keys_removed 🔴 critical Key yang sebelumnya ada sekarang hilang
item_schema_changed 🔴 critical Keys dalam array item berubah
fields_became_null 🟡 warn Field yang sebelumnya ada data kini null
count_changed 🟡 warn Jumlah item array berubah drastis (≥50%)
keys_added 🟢 info Key baru muncul
fields_recovered 🟢 info Field yang sebelumnya null kini ada data
value_changed 🟢 info Nilai berubah (hanya saat sensitivity: 'value')

API manual: scraper.diff.clearSnapshot(url), .clearAll().

---

Smart Cache

TTL-based cache di level HTTP response — skip network kalau masih fresh, tapi tetap jalanin extraction/health/diff/validation di setiap call (jadi metadata tetap akurat).

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

Key Type Default Keterangan
ttl number 3600 Detik sebelum entry kadaluarsa
storage 'memory' \| 'disk' 'memory' disk persist lintas restart proses
storageDir string .sengkrep-ryna-cache Lokasi penyimpanan kalau storage: 'disk'
maxItems number 1000 Batas entry di memory (LRU-ish eviction)

API manual: scraper.cache.stats() → { hits, misses, sets, size, hitRate }.

---

Cookie Jar & Sessions

Aktif secara default (cookies: true). Cookie dari Set-Cookie otomatis ditangkap dan dikirim ulang ke request berikutnya yang ke domain yang sama — termasuk subdomain.

```js
const scraper = sengkrep.create({ cookies: true });

await scraper.login('https://example.com/login', { user: 'qrtz', pass: 'secret' });
const dashboard = await scraper.extract('https://example.com/dashboard', schema);
```

Matiin kalau nggak perlu (request jadi sedikit lebih cepat): sengkrep.create({ cookies: false }).

API manual: scraper.cookieJar.getAll(hostname), .export(), .import(snapshot), .clear(hostname?) — export()/import() berguna buat nyimpen session ke disk antar proses.

---

Proxy Rotation

CONNECT tunnel buat HTTPS dan forward proxy buat HTTP — keduanya diimplementasi native pakai net/tls/http/https, tanpa dependency tambahan kayak https-proxy-agent.

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

Strategy Keterangan
round-robin Gilir satu-satu sesuai urutan
random Pilih acak tiap request
sticky Domain yang sama selalu dapet proxy yang sama (konsisten per-site)

Proxy yang gagal berturut-turut (proxyMaxFailures, default 3) otomatis ditandai unhealthy dan dihindari sampai proxy lain juga gagal. Sukses me-reset hitungan failure-nya.

API manual: scraper.proxyRotator.stats() → [{ proxy, failures, healthy }].

---

Rate Limiter

Cegah satu domain di-hammer, terpisah per hostname (jadi domain lain nggak ikut melambat).

```js
const scraper = sengkrep.create({
  rateLimit: {
    requestsPerSecond: 2,
    concurrency: 3,
  },
});
```

Key Type Keterangan
requestsPerSecond number Jarak minimum antar request ke hostname yang sama
concurrency number Maksimal request simultan ke hostname yang sama

Kombinasi keduanya bisa dipakai sekaligus. Default: disabled (undefined/null, nggak ada limit).

---

Interceptors

Axios-style middleware, selalu tersedia di scraper.interceptors — nggak perlu config khusus buat enable.

```js
scraper.interceptors.request.use((config) => {
  config.headers['X-Custom-Header'] = 'my-value';
  console.log(`➡️ Request ke: ${config.url}`);
  return config;
});

scraper.interceptors.response.use((response) => {
  response.body = response.body.replace(/&nbsp;/g, ' ');
  return response;
}, (error) => {
  if (error.status === 404) {
    console.log('⚠️ Page not found, skipping...');
    return { status: 404, body: '', headers: {}, skipped: true };
  }
  throw error;
});
```

request.use(onFulfilled) jalan sebelum request dikirim — terima dan return objek { url, method, headers, body, proxy, signal, timeout }.

response.use(onFulfilled, onRejected) jalan setelah response diterima (atau gagal). onRejected bisa recover dari error dengan return value baru (bukan throw), persis kayak contoh 404-skip di atas.

use() return ID yang bisa dipakai buat eject(id) kalau interceptor-nya mau dicabut.

---

Sitemap Discovery

```js
const urls = await scraper.discover('https://example.com', {
  maxDepth: 2,
  pattern: /\/blog\//,
});
```

Alurnya: fetch robots.txt → cari baris Sitemap: → kalau nggak ketemu, fallback ke /sitemap.xml → parse <urlset> atau <sitemapindex> (rekursif sampai maxDepth) → kumpulin semua <loc>.

---

Multi-format Export

```js
const { toCSV, toJSON, toNDJSON, toMarkdownTable, exportData } = require('sengkrep-ryna');

const csv = toCSV(data);
const md  = toMarkdownTable(data);

exportData(data, { format: 'ndjson', path: './output/dump.ndjson' });
```

Bisa dipakai langsung (scraper.export(...)) atau lewat fungsi util standalone kalau data udah ada di tangan.

---

Webhook Notifications

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

Fire-and-forget POST JSON { event, timestamp, ...payload } ke endpoint yang dikonfigurasi. Gagal kirim webhook nggak akan bikin scraping job-nya ikut gagal.

---

Configuration Reference

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

Error Handling

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

FetchError codes:

Code Keterangan
HTTP_ERROR Server return status ≥ 400
NETWORK_ERROR Koneksi gagal
TIMEOUT Request melebihi timeout (TimeoutError)
CANCELED Dibatalkan lewat AbortSignal (CanceledError)
PROXY_ERROR Proxy CONNECT/tunnel gagal (ProxyError)
TOO_MANY_REDIRECTS Redirect loop atau melebihi maxRedirects
INVALID_URL URL tidak valid
DECOMPRESS_ERROR Gagal decompress response body

---

Accessing Meta (_ryna)

Hasil semua modul tersimpan di property _ryna yang non-enumerable — tidak muncul saat console.log/JSON.stringify, tapi bisa diakses langsung.

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

Testing

Library ini punya test suite sendiri (78 test) yang jalan 100% lokal — nggak butuh akses internet sama sekali. Cocok dites di Termux/CI/offline.

```bash
npm test
```

Yang dites: HTTP fetch (redirect, gzip, timeout, abort), proxy CONNECT tunnel via local forward-proxy + self-signed HTTPS server, cookie roundtrip, retry backoff terhadap endpoint yang sengaja dibikin flaky, cache TTL/eviction, rate limiter timing, proxy rotator strategy, JSON path extraction, schema validation, health monitor alerting, diff detection, fingerprint randomization, webhook delivery, dan export ke semua format — plus integration test end-to-end lewat Ryna.extract/batch/paginate/login/discover/export.

Kalau openssl nggak ketemu di environment lo, test yang butuh HTTPS-via-proxy otomatis di-skip (bukan fail) — sisanya tetap jalan penuh.

---

Examples

E-commerce dengan full reliability + proxy + cache

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

Situs login-walled

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

JSON API scraping (situs yang data-nya dari XHR/fetch)

```js
const scraper = sengkrep.create({ logLevel: 'info' });

const data = await scraper.extract('https://example.com/api/v2/products?page=1', {
  products: 'data.products[].name',
  prices:   'data.products[].price.amount',
  total:    'meta.total_count',
}, { responseType: 'json' });

console.log(data.products.length, 'produk,', data.total, 'total');
```

Full-site crawl pakai sitemap discovery + export

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

News batch scraper dengan diff detection + webhook

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

Pakai modul standalone tanpa Ryna instance

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

Architecture

```
sengkrep-ryna/
├── index.js                    Entry point + convenience API
├── example.js                  Runnable quick-start demo
├── test/
│   ├── server.js                Local HTTP/HTTPS/proxy fixtures (zero external network)
│   ├── run.js                   Unit tests — module-level
│   └── integration.js           Integration tests — full Ryna orchestration
└── src/
    ├── Ryna.js                  Orchestrator utama
    ├── core/
    │   ├── Fetcher.js            HTTP client (proxy, cookies, abort, interceptors, decompress)
    │   ├── ProxyTunnel.js        CONNECT tunnel native (zero dependency)
    │   ├── Extractor.js          HTML extraction engine (cheerio)
    │   ├── JsonExtractor.js      JSON path extraction engine
    │   └── Retry.js              Adaptive retry per-status strategy
    └── modules/
        ├── Fingerprint.js        UA rotation, header randomization, timing jitter
        ├── SchemaValidator.js    Validasi data hasil ekstraksi
        ├── HealthMonitor.js      Selector health tracking
        ├── DiffDetector.js       Structural diff detection
        ├── Cache.js              TTL response cache
        ├── CookieJar.js          Session/cookie persistence
        ├── ProxyRotator.js       Proxy pool strategy + health tracking
        ├── RateLimiter.js        Per-hostname token bucket
        ├── Interceptors.js       Request/response middleware chain
        ├── Discover.js           Sitemap + robots.txt crawler
        └── Webhook.js            Lifecycle event notifier
    └── utils/
        ├── logger.js              Colored leveled logger
        ├── storage.js             JSON file storage (DiffDetector + disk Cache)
        └── exporter.js            CSV/JSON/NDJSON/Markdown writers
```

Request flow:

```
scraper.extract(url, schema)
  └── _resolveUrl (baseURL) + _applyParams (query string)
  └── Cache.get() → HIT? return cached response
  └── Retry.run()
      └── RateLimiter.acquire(hostname)
      └── ProxyRotator.next(hostname)
      └── Fetcher.fetch()
          └── Interceptors.request.run(config)
          └── Fingerprint.buildHeaders()
          └── CookieJar.getCookieHeader() / setFromHeaders()
          └── ProxyTunnel (CONNECT for https, forward route for http)
          └── Decompress response (gzip/br/deflate)
          └── Interceptors.response.run(raw) / runError(err)
  └── Cache.set()
  └── _looksLikeJson() → Extractor (cheerio) atau JsonExtractor (path)
  └── HealthMonitor.record()
  └── DiffDetector.check()
  └── SchemaValidator.validate()
  └── Webhook.fire('onComplete' | 'onError')
  └── Return { ...data, _ryna: { cache, responseType, health, diff, validation } }
```

---

Tips & Troubleshooting

Selector return null padahal di browser ada datanya — kemungkinan besar situsnya render via JavaScript (client-side rendering). sengkrep-ryna cuma parsing HTML mentah, nggak menjalankan JS. Cek view-source: di browser; kalau datanya nggak ada di situ, coba cari endpoint JSON internal-nya lewat tab Network di DevTools dan pakai responseType: 'json' dengan JsonExtractor — biasanya lebih stabil daripada scraping HTML yang di-render JS sekalipun pakai headless browser.

Proxy auth gagal terus — format URL proxy yang didukung: http://user:pass@host:port. Pastikan username/password di-encodeURIComponent kalau mengandung karakter spesial (@, :, /).

rejectUnauthorized: false itu buat apa — cuma buat proxy/target dengan self-signed certificate (internal tools, dev environment). Jangan dipakai ke situs publik di production, itu menghilangkan validasi certificate sepenuhnya.

Cache nggak ke-invalidate pas saya butuh data fresh — panggil scraper.cache.delete(url) atau scraper.cache.clear() sebelum extract, atau set ttl lebih pendek untuk data yang sering berubah.

Health monitor / diff detector kelihatan "noisy" di awal — wajar, butuh beberapa run dulu (windowSize) buat punya baseline yang reliable. First run selalu firstRun: true tanpa alert.

---

License

MIT © rynaqrtz