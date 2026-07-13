const { parseRateLimitHeaders }             = require('./utils/rateLimitHeaders');
const { createHash }                       = require('crypto');
const { Fetcher }                          = require('./core/Fetcher');
const { Http2Fetcher }                     = require('./core/Http2Fetcher');
const { Extractor }                        = require('./core/Extractor');
const { JsonExtractor }                    = require('./core/JsonExtractor');
const Retry                                = require('./core/Retry');
const Fingerprint                          = require('./modules/Fingerprint');
const HealthMonitor                        = require('./modules/HealthMonitor');
const DiffDetector                         = require('./modules/DiffDetector');
const { SchemaValidator, ValidationError } = require('./modules/SchemaValidator');
const Cache                                = require('./modules/Cache');
const CookieJar                            = require('./modules/CookieJar');
const RateLimiter                          = require('./modules/RateLimiter');
const ProxyRotator                         = require('./modules/ProxyRotator');
const Interceptors                         = require('./modules/Interceptors');
const Webhook                              = require('./modules/Webhook');
const Discover                             = require('./modules/Discover');
const { SecurityGuard }                    = require('./modules/SecurityGuard');
const { CircuitBreaker }                   = require('./modules/CircuitBreaker');
const Incremental                          = require('./modules/Incremental');
const CsrfHandler                          = require('./modules/CsrfHandler');
const AuthManager                          = require('./modules/AuthManager');
const SessionPool                          = require('./modules/SessionPool');
const PluginSystem                         = require('./modules/PluginSystem');
const CrawlQueue                           = require('./modules/CrawlQueue');
const Observability                        = require('./modules/Observability');
const HarRecorder                          = require('./modules/HarRecorder');
const WordPress                            = require('./modules/WordPress');
const GraphQLClient                        = require('./modules/GraphQLClient');
const DnsCache                             = require('./modules/DnsCache');
const FormHandler                          = require('./modules/FormHandler');
const ProgressBar                          = require('./modules/ProgressBar');
const { detectNextLink, detectTotalPages }  = require('./modules/PaginationDetector');
const { inferSchema }                       = require('./modules/SchemaInference');
const { DistributedQueue, MemoryAdapter }   = require('./modules/DistributedQueue');
const Logger                               = require('./utils/logger');
const { exportData }                       = require('./utils/exporter');
const { parseFeed, parseCSV }              = require('./utils/contentHandlers');
const { extractJsonLd, extractMicrodata, extractDataAttributes } = require('./utils/microdata');
const { extractScripts }                   = require('./utils/scriptExtractor');
const { extractLinks, UrlDeduplicator }    = require('./utils/urlUtils');
const StreamWriter                         = require('./utils/streamWriter');
const contentSafety                        = require('./utils/contentSafety');

class Ryna {
  constructor(options = {}) {
    this.options = options;

    this.logger = new Logger(
      options.logLevel  ?? 'info',
      options.logPretty ?? true,
    );

    this.fingerprint  = new Fingerprint(options.fingerprint ?? {});
    this.cookieJar    = options.cookies === false ? null : new CookieJar();
    this.interceptors = new Interceptors();
    this.plugins      = new PluginSystem();

    this.cache = options.cache
      ? new Cache(typeof options.cache === 'object' ? options.cache : {})
      : null;

    this.rateLimiter = new RateLimiter(options.rateLimit ?? {});

    this.proxyRotator = new ProxyRotator({
      proxies:     options.proxies         ?? [],
      strategy:    options.proxyStrategy   ?? 'round-robin',
      maxFailures: options.proxyMaxFailures ?? 3,
    });

    this.webhook = new Webhook(options.webhook ?? {});

    this.security = new SecurityGuard(options.security ?? {});

    this.circuitBreaker = options.circuitBreaker
      ? new CircuitBreaker(typeof options.circuitBreaker === 'object' ? options.circuitBreaker : {})
      : null;

    this.incremental = options.incremental
      ? new Incremental(typeof options.incremental === 'object' ? options.incremental : {})
      : null;

    this.csrf = new CsrfHandler(options.csrf ?? {});
    this.auth = new AuthManager(options.auth ?? {});

    this.sessionPool = new SessionPool(typeof options.sessionPool === 'object' ? options.sessionPool : {});

    this.observability = new Observability(options.observability ?? {});

    this.har = options.har ? new HarRecorder().attach(this.interceptors) : null;

    this.dnsCache = options.dns
      ? new DnsCache(typeof options.dns === 'object' ? options.dns : {})
      : null;

    this.formHandler = new FormHandler({ csrf: options.csrf ?? {} });
    this.deduplicator = new UrlDeduplicator(options.dedup ?? {});

    this.fetcher = new Fetcher({
      timeout:      options.timeout      ?? 30000,
      maxRedirects: options.maxRedirects ?? 5,
      fingerprint:  this.fingerprint,
      cookieJar:    this.cookieJar,
      interceptors: this.interceptors,
      dnsCache:     this.dnsCache,
      keepAlive:    options.keepAlive    ?? true,
      maxMemoryBuffer: options.maxMemoryBuffer ?? (10 * 1024 * 1024),
    });

    this.http2Fetcher = options.http2
      ? new Http2Fetcher({ timeout: options.timeout ?? 30000, fingerprint: this.fingerprint, cookieJar: this.cookieJar })
      : null;

    this.retry = new Retry({
      ...(options.retry ?? {}),
      onRetry: (info) => {
        this.logger.warn(`Retry #${info.attempt} | status: ${info.status ?? info.code} | waiting ${info.waitMs}ms`);
        if (options.retry?.onRetry) options.retry.onRetry(info);
      },
    });

    this.extractor     = new Extractor();
    this.jsonExtractor = new JsonExtractor();

    this.health = options.health !== false
      ? new HealthMonitor(typeof options.health === 'object' ? options.health : {})
      : null;

    this.diff = options.diff !== false
      ? new DiffDetector(typeof options.diff === 'object' ? options.diff : {})
      : null;

    this.validator = options.validate
      ? new SchemaValidator(options.validate)
      : null;

    this.discoverer = new Discover(this.fetcher);
    this.wordpress   = new WordPress(this);
    this.graphql     = new GraphQLClient(this);

    this.authManager    = this.auth;
    this.securityGuard  = this.security;
    this.csrfHandler    = this.csrf;
    this.healthMonitor  = this.health;
    this.diffDetector   = this.diff;
    this.pluginSystem   = this.plugins;
    this.cacheManager   = this.cache;
    this.circuitBreakerManager = this.circuitBreaker;
  }

  _resolveUrl(url) {
    if (!this.options.baseURL) return url;
    try {
      return new URL(url, this.options.baseURL).href;
    } catch {
      return url;
    }
  }

  _applyParams(url, params) {
    if (!params) return url;
    try {
      const u = new URL(url);
      for (const [key, value] of Object.entries(params)) {
        u.searchParams.set(key, value);
      }
      return u.href;
    } catch {
      return url;
    }
  }

  _looksLikeJson(res) {
    const contentType = (res.headers['content-type'] ?? '').toLowerCase();
    if (contentType.includes('application/json')) return true;
    const trimmed = res.body.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  _looksLikeFeed(res) {
    const contentType = (res.headers['content-type'] ?? '').toLowerCase();
    if (contentType.includes('rss') || contentType.includes('atom') || contentType.includes('xml')) return true;
    const trimmed = res.body.trim();
    return trimmed.startsWith('<?xml') && (res.body.includes('<rss') || res.body.includes('<feed'));
  }

  _looksLikeCsv(res) {
    return (res.headers['content-type'] ?? '').toLowerCase().includes('csv');
  }

  async _fetch(url, reqOptions = {}) {
    let resolvedUrl = this._resolveUrl(url);
    if (reqOptions.params) resolvedUrl = this._applyParams(resolvedUrl, reqOptions.params);

    await this.security.check(resolvedUrl);

    const hostname = new URL(resolvedUrl).hostname;
    const method    = reqOptions.method ?? 'GET';

    if (this.circuitBreaker) this.circuitBreaker.assertCanRequest(hostname);

    if (this.cache) {
      const cached = this.cache.get(resolvedUrl, method);
      if (cached) {
        this.logger.debug(`[cache] HIT ${resolvedUrl}`);
        return { ...cached, fromCache: true };
      }
    }

    const conditionalHeaders = this.incremental ? this.incremental.getConditionalHeaders(resolvedUrl) : {};

    let attemptedRefresh = false;

    const result = await this.retry.run(async (attempt) => {
      const release = this.rateLimiter.enabled ? await this.rateLimiter.acquire(hostname) : null;
      const proxy   = this.proxyRotator.enabled ? this.proxyRotator.next(hostname) : null;

      try {
        if (attempt > 0) {
          await this.fingerprint.humanDelay(this.options.delayMin ?? 500, this.options.delayMax ?? 2500);
        } else if (this.options.delay) {
          await this.fingerprint.humanDelay(this.options.delay * 0.8, this.options.delay * 1.2);
        }

        this.logger.debug(`→ ${resolvedUrl}${proxy ? ' via proxy' : ''}`);

        const buildHeaders = () => ({ ...conditionalHeaders, ...this.auth.buildHeaders(), ...(reqOptions.headers ?? {}) });

        let res;
        try {
          res = await this.fetcher.fetch(resolvedUrl, { ...reqOptions, headers: buildHeaders(), proxy });
        } catch (err) {
          if (err.status === 401 && this.auth.shouldRefresh(401) && !attemptedRefresh) {
            attemptedRefresh = true;
            await this.auth.refresh();
            res = await this.fetcher.fetch(resolvedUrl, { ...reqOptions, headers: buildHeaders(), proxy });
          } else {
            throw err;
          }
        }

        if (proxy) this.proxyRotator.reportSuccess(proxy);
        if (this.circuitBreaker) this.circuitBreaker.recordSuccess(hostname);
        return res;
      } catch (err) {
        if (proxy && err.code === 'PROXY_ERROR') this.proxyRotator.reportFailure(proxy);
        if (this.circuitBreaker && err.code !== 'CIRCUIT_OPEN') this.circuitBreaker.recordFailure(hostname);
        throw err;
      } finally {
        if (release) release();
      }
    });

    if (this.incremental && !result.notModified) {
      this.incremental.record(resolvedUrl, result.headers, null);
    }

    if (this.cache) this.cache.set(resolvedUrl, result, method);

    return result;
  }

  async extract(url, schema, options = {}) {
    this.webhook.fire('onStart', { url });

    try {
      let mergedOptions = await this.plugins.run('beforeRequest', { url, options });
      url               = mergedOptions.url;
      options           = mergedOptions.options;

      const res = await this._fetch(url, { ...(options.request ?? {}), params: options.params });
      this.logger.debug(`← ${res.status} ${url}${res.fromCache ? ' (cache)' : ''}`);

      if (res.notModified && this.incremental) {
        const snapshot = this.incremental.getSnapshot(url);
        if (snapshot) {
          this.observability.recordSuccess(url);
          return snapshot;
        }
      }

      if (res.binary || res.streamed) {
        const meta = {
          responseType: res.binary ? 'binary' : 'streamed',
          sniffedType:  res.sniffedType ?? null,
          filePath:     res.filePath ?? null,
          size:         res.responseSize ?? res.size ?? null,
        };

        if (!options.allowBinary && !options.allowStreamed) {
          const err  = new Error(`Response is ${meta.responseType} content (${meta.sniffedType ?? 'unknown type'}), not text. Pass { allowBinary: true } or { allowStreamed: true } to receive it, or use a dedicated download flow.`);
          err.name   = 'BinaryResponseError';
          err.code   = 'BINARY_RESPONSE';
          err.meta   = meta;
          throw err;
        }

        const result = res.binary
          ? { binary: true, sniffedType: res.sniffedType, size: meta.size, buffer: options.includeBuffer ? res.bodyBuffer : undefined }
          : { streamed: true, filePath: res.filePath, size: meta.size };

        Object.defineProperty(result, '_ryna', { value: meta, enumerable: false, writable: true });
        this.observability.recordSuccess(url);
        return result;
      }

      const responseType = options.responseType ?? this.options.responseType ?? 'auto';

      let data, health, parsedAs;

      if (responseType === 'rss' || (responseType === 'auto' && this._looksLikeFeed(res))) {
        const feed = parseFeed(res.body);
        data       = feed;
        health     = {};
        parsedAs   = 'feed';
      } else if (responseType === 'csv' || (responseType === 'auto' && this._looksLikeCsv(res))) {
        data     = parseCSV(res.body);
        health   = {};
        parsedAs = 'csv';
      } else {
        const useJson = responseType === 'json' || (responseType === 'auto' && this._looksLikeJson(res));
        const result  = useJson
          ? this.jsonExtractor.extract(res.body, schema)
          : this.extractor.extract(res.body, schema);
        data     = result.data;
        health   = result.health;
        parsedAs = useJson ? 'json' : 'html';
      }

      this.logger.debug(`Extracted from ${url} as ${parsedAs}`);

      const meta = {
        cache:        { hit: res.fromCache === true },
        responseType: parsedAs,
      };

      const rateLimitInfo = parseRateLimitHeaders(res.headers);
      if (rateLimitInfo) meta.rateLimit = rateLimitInfo;

      if (this.health && parsedAs !== 'feed' && parsedAs !== 'csv') {
        const report = this.health.record(url, health);
        meta.health  = report;
        if (!report.healthy) report.alerts.forEach(a => this.logger.warn(`[health] ${a.message}`));
      }

      if (this.diff) {
        const report = this.diff.check(url, data);
        meta.diff    = report;
        if (report.changes.length > 0) {
          this.logger.warn(`[diff] ${report.changes.length} change(s) detected for ${url}`);
        }
      }

      if (this.validator) {
        const report    = this.validator.validate(data);
        meta.validation = report;
        if (!report.valid) {
          report.errors.forEach(e => this.logger.warn(`[validate] ${e.message}`));
          if (options.strict) throw new ValidationError('Validation failed', report.errors);
        }
      }

      let result = Array.isArray(data) ? data : { ...data };
      Object.defineProperty(result, '_ryna', { value: meta, enumerable: false, writable: true });

      const afterExtract = await this.plugins.run('afterExtract', { data: result, meta });
      result              = afterExtract.data;
      Object.defineProperty(result, '_ryna', { value: afterExtract.meta, enumerable: false, writable: true });

      if (this.incremental && !res.notModified) {
        this.incremental.record(url, res.headers, result);
      }

      this.observability.recordSuccess(url);
      this.webhook.fire('onComplete', { url, fields: Object.keys(data).length });

      return result;
    } catch (err) {
      this.observability.recordFailure(url, err);
      await this.plugins.run('onError', { url, error: err });
      this.webhook.fire('onError', { url, message: err.message, code: err.code });
      throw err;
    }
  }

  async batch(urls, schema, options = {}) {
    const {
      concurrency = 3,
      delay       = 800,
      onProgress  = null,
      strict      = false,
      randomOrder = false,
      progressBar = false,
    } = options;

    const queue = randomOrder ? [...urls].sort(() => Math.random() - 0.5) : urls;
    const bar   = progressBar ? new ProgressBar({ total: queue.length, label: 'scraping' }) : null;

    const results = [];

    for (let i = 0; i < queue.length; i += concurrency) {
      const chunk = queue.slice(i, i + concurrency);

      const settled = await Promise.allSettled(
        chunk.map(url => this.extract(url, schema, { ...options, strict }))
      );

      for (let j = 0; j < settled.length; j++) {
        const url = chunk[j];
        const r   = settled[j];
        if (r.status === 'fulfilled') {
          results.push({ url, data: r.value, error: null });
        } else {
          this.logger.error(`Failed: ${url} — ${r.reason.message}`);
          results.push({ url, data: null, error: r.reason });
        }
      }

      const done = Math.min(i + concurrency, queue.length);
      if (onProgress) onProgress(done, queue.length);
      if (bar) bar.update(done);
      this.webhook.fire('onProgress', { done, total: queue.length });

      const remaining = queue.length - done;
      if (remaining > 0 && delay > 0) {
        await this.fingerprint.humanDelay(delay * 0.8, delay * 1.4);
      }
    }

    if (bar) bar.finish();

    return results;
  }

  async *stream(urls, schema, options = {}) {
    const { concurrency = 3, delay = 800 } = options;

    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      const settled = await Promise.allSettled(chunk.map(url => this.extract(url, schema, options)));

      for (let j = 0; j < settled.length; j++) {
        const url = chunk[j];
        const r   = settled[j];
        yield r.status === 'fulfilled'
          ? { url, data: r.value, error: null }
          : { url, data: null, error: r.reason };
      }

      const remaining = urls.length - (i + concurrency);
      if (remaining > 0 && delay > 0) {
        await this.fingerprint.humanDelay(delay * 0.8, delay * 1.4);
      }
    }
  }

  async paginate(startUrl, paginationConfig, schema, options = {}) {
    const {
      nextSelector,
      itemsSelector     = null,
      maxPages          = 10,
      delayBetweenPages = 1200,
      stopOnDuplicate   = true,
    } = paginationConfig;

    const allItems = [];
    let   url          = startUrl;
    let   page         = 0;
    let   detectedTotal  = null;
    let   lastPageHash    = null;
    let   duplicateStopped = false;

    while (url && page < maxPages) {
      this.logger.info(`[paginate] page ${page + 1}: ${url}`);

      const res = await this._fetch(url);
      const $   = this.extractor.load(res.body);

      if (page === 0 && nextSelector === 'auto') {
        detectedTotal = detectTotalPages($);
        if (detectedTotal > 1) this.logger.info(`[paginate] detected ~${detectedTotal} total pages from pagination widget`);
      }

      const pageItems = [];

      if (itemsSelector) {
        $(itemsSelector).each((_, el) => {
          const itemHtml        = $.html(el);
          const { data: item }  = this.extractor.extract(itemHtml, schema);
          pageItems.push(item);
        });
      } else {
        const { data } = this.extractor.extract(res.body, schema);
        pageItems.push(data);
      }

      if (stopOnDuplicate) {
        const pageHash = createHash('sha256').update(JSON.stringify(pageItems)).digest('hex');
        if (page > 0 && pageHash === lastPageHash) {
          this.logger.warn(`[paginate] page ${page + 1} content is identical to the previous page — stopping (the site likely repeats its last page instead of ending pagination). Pass { stopOnDuplicate: false } to disable this check.`);
          duplicateStopped = true;
          break;
        }
        lastPageHash = pageHash;
      }

      allItems.push(...pageItems);

      const nextHref = nextSelector === 'auto' ? null : $(nextSelector).attr('href');
      const detected = nextSelector === 'auto' ? detectNextLink($, url) : null;

      url  = detected ? detected.url : (nextHref ? new URL(nextHref, url).href : null);
      page++;

      if (url) {
        await this.fingerprint.humanDelay(
          delayBetweenPages * 0.8,
          delayBetweenPages * 1.2,
        );
      }
    }

    this.logger.info(`[paginate] done — ${page} pages, ${allItems.length} items${duplicateStopped ? ' (stopped early: duplicate page detected)' : ''}`);
    return allItems;
  }

  async fetch(url, options = {}) {
    const res = await this._fetch(url, { ...(options.request ?? {}), params: options.params });

    return {
      status:      res.status,
      headers:     res.headers,
      url:         res.url,
      body:        res.body,
      binary:      res.binary ?? false,
      streamed:    res.streamed ?? false,
      filePath:    res.filePath ?? null,
      fromCache:   res.fromCache === true,
      notModified: res.notModified === true,
    };
  }

  load(html) {
    return this.extractor.load(html);
  }

  async login(url, formData = {}, options = {}) {
    let token = null;

    if (this.csrf.enabled) {
      try {
        const page = await this._fetch(url);
        const $    = this.extractor.load(page.body);
        token      = this.csrf.extractFromHtml($) ?? this.csrf.extractFromCookies(this.cookieJar, new URL(url).hostname);
      } catch {
        token = null;
      }
    }

    const body    = this.csrf.buildFormBody(formData, token);
    const headers = this.csrf.buildHeaders(token, { 'Content-Type': 'application/x-www-form-urlencoded', ...(options.headers ?? {}) });

    const res = await this._fetch(url, { method: 'POST', headers, body });

    const ok = res.status < 400;
    this.logger[ok ? 'info' : 'warn'](`[login] ${res.status} ${url}`);
    return ok;
  }

  async discover(origin, options = {}) {
    return this.discoverer.run(origin, options);
  }

  async isAllowed(url, userAgent = '*') {
    return this.discoverer.isAllowed(url, userAgent);
  }

  async getCrawlDelay(origin, userAgent = '*') {
    return this.discoverer.getCrawlDelay(origin, userAgent);
  }

  async export(input, schema, options = {}) {
    let data;

    if (options.pagination) {
      data = await this.paginate(input, options.pagination, schema, options);
    } else if (Array.isArray(input)) {
      const isUrls = input.every(item => typeof item === 'string');
      if (isUrls) {
        const results = await this.batch(input, schema, options);
        data = results.filter(r => r.data).map(r => r.data);
      } else {
        data = input;
      }
    } else if (typeof input === 'string') {
      data = await this.extract(input, schema, options);
    } else {
      data = input;
    }

    return exportData(data, options);
  }

  crawl(options = {}) {
    const queue = new CrawlQueue(options);

    const visitFn = async (url) => {
      if (options.respectRobotsTxt) {
        const allowed = await this.isAllowed(url, options.userAgent ?? '*');
        if (!allowed) {
          this.logger.warn(`[crawl] skipped (disallowed by robots.txt): ${url}`);
          const err = new Error(`Disallowed by robots.txt: ${url}`);
          err.code  = 'ROBOTS_DISALLOWED';
          throw err;
        }
      }

      const res  = await this._fetch(url);
      const $    = this.extractor.load(res.body);
      const { data } = this.extractor.extract(res.body, options.schema ?? {});
      let links = extractLinks($, url, options.linkOptions ?? {});

      if (options.respectRobotsTxt) {
        const checks = await Promise.all(links.map(l => this.isAllowed(l, options.userAgent ?? '*')));
        links = links.filter((_, i) => checks[i]);
      }

      return { data, links };
    };

    return {
      queue,
      start:  () => queue.start(visitFn),
      resume: () => queue.resume(visitFn),
      pause:  () => queue.pause(),
      on:     (event, fn) => queue.on(event, fn),
      results: () => queue.results(),
      stats:   () => queue.stats(),
    };
  }

  async submitForm(url, formSelector, overrides = {}) {
    const page = await this._fetch(url);
    const $    = this.extractor.load(page.body);
    const parsed = this.formHandler.parse($, formSelector, url);

    if (!parsed) {
      const err = new Error(`No form matched selector "${formSelector || 'form'}" at ${url}`);
      err.name  = 'FormNotFoundError';
      throw err;
    }

    const submission = this.formHandler.buildSubmission(parsed, overrides);
    const res = await this._fetch(submission.url, {
      method:  submission.method,
      headers: submission.headers,
      body:    submission.method === 'GET' ? null : submission.body,
    });

    return { status: res.status, headers: res.headers, body: res.body, url: res.url };
  }

  async extractJsonLd(url) {
    const res = await this._fetch(url);
    const $   = this.extractor.load(res.body);
    return extractJsonLd($);
  }

  async extractMicrodata(url) {
    const res = await this._fetch(url);
    const $   = this.extractor.load(res.body);
    return extractMicrodata($);
  }

  async extractDataAttributes(url, selector) {
    const res = await this._fetch(url);
    const $   = this.extractor.load(res.body);
    return extractDataAttributes($, selector);
  }

  async extractScripts(url) {
    const res = await this._fetch(url);
    const $   = this.extractor.load(res.body);
    return extractScripts($, url);
  }

  async inferSchema(url, options = {}) {
    const res = await this._fetch(url);
    const $   = this.extractor.load(res.body);
    return inferSchema($, options);
  }

  distributedQueue(options = {}) {
    return new DistributedQueue(options);
  }

  getObservabilityReport() {
    return this.observability.report();
  }

  saveHar(filePath) {
    if (!this.har) throw new Error('HAR recording not enabled. Pass { har: true } to sengkrep.create()');
    this.har.save(filePath);
  }
}

module.exports = Ryna;
