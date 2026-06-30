const { Fetcher }                          = require('./core/Fetcher');
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
const Logger                               = require('./utils/logger');
const { exportData }                       = require('./utils/exporter');

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

    this.fetcher = new Fetcher({
      timeout:      options.timeout      ?? 30000,
      maxRedirects: options.maxRedirects ?? 5,
      fingerprint:  this.fingerprint,
      cookieJar:    this.cookieJar,
      interceptors: this.interceptors,
    });

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

    this.discoverer = new Discover({ fetch: (url) => this._fetch(url) });
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

  async _fetch(url, reqOptions = {}) {
    let resolvedUrl = this._resolveUrl(url);
    if (reqOptions.params) resolvedUrl = this._applyParams(resolvedUrl, reqOptions.params);

    const hostname = new URL(resolvedUrl).hostname;
    const method    = reqOptions.method ?? 'GET';

    if (this.cache) {
      const cached = this.cache.get(resolvedUrl, method);
      if (cached) {
        this.logger.debug(`[cache] HIT ${resolvedUrl}`);
        return { ...cached, fromCache: true };
      }
    }

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
        const res = await this.fetcher.fetch(resolvedUrl, { ...reqOptions, proxy });
        if (proxy) this.proxyRotator.reportSuccess(proxy);
        return res;
      } catch (err) {
        if (proxy && err.code === 'PROXY_ERROR') this.proxyRotator.reportFailure(proxy);
        throw err;
      } finally {
        if (release) release();
      }
    });

    if (this.cache) this.cache.set(resolvedUrl, result, method);

    return result;
  }

  async extract(url, schema, options = {}) {
    this.webhook.fire('onStart', { url });

    try {
      const res = await this._fetch(url, { ...(options.request ?? {}), params: options.params });
      this.logger.debug(`← ${res.status} ${url}${res.fromCache ? ' (cache)' : ''}`);

      const responseType = options.responseType ?? this.options.responseType ?? 'auto';
      const useJson       = responseType === 'json' || (responseType === 'auto' && this._looksLikeJson(res));

      const { data, health } = useJson
        ? this.jsonExtractor.extract(res.body, schema)
        : this.extractor.extract(res.body, schema);

      this.logger.debug(`Extracted ${Object.keys(data).length} field(s) from ${url}`);

      const meta = {
        cache:        { hit: res.fromCache === true },
        responseType: useJson ? 'json' : 'html',
      };

      if (this.health) {
        const report = this.health.record(url, health);
        meta.health  = report;
        if (!report.healthy) report.alerts.forEach(a => this.logger.warn(`[health] ${a.message}`));
      }

      if (this.diff) {
        const report = this.diff.check(url, data);
        meta.diff    = report;
        if (report.changes.length > 0) {
          this.logger.warn(`[diff] ${report.changes.length} change(s) detected for ${url}`);
          report.changes.forEach(c => this.logger.debug(`  · [${c.severity}] ${c.type}`));
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

      const result = { ...data };
      Object.defineProperty(result, '_ryna', { value: meta, enumerable: false, writable: true });

      this.webhook.fire('onComplete', { url, fields: Object.keys(data).length });

      return result;
    } catch (err) {
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
    } = options;

    const results = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);

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

      const done = Math.min(i + concurrency, urls.length);
      if (onProgress) onProgress(done, urls.length);
      this.webhook.fire('onProgress', { done, total: urls.length });

      const remaining = urls.length - done;
      if (remaining > 0 && delay > 0) {
        await this.fingerprint.humanDelay(delay * 0.8, delay * 1.4);
      }
    }

    return results;
  }

  async paginate(startUrl, paginationConfig, schema, options = {}) {
    const {
      nextSelector,
      itemsSelector     = null,
      maxPages          = 10,
      delayBetweenPages = 1200,
    } = paginationConfig;

    const allItems = [];
    let   url      = startUrl;
    let   page     = 0;

    while (url && page < maxPages) {
      this.logger.info(`[paginate] page ${page + 1}: ${url}`);

      const res = await this._fetch(url);
      const $   = this.extractor.load(res.body);

      if (itemsSelector) {
        $(itemsSelector).each((_, el) => {
          const itemHtml        = $.html(el);
          const { data: item }  = this.extractor.extract(itemHtml, schema);
          allItems.push(item);
        });
      } else {
        const { data } = this.extractor.extract(res.body, schema);
        allItems.push(data);
      }

      const nextHref = $(nextSelector).attr('href');
      url            = nextHref ? new URL(nextHref, url).href : null;
      page++;

      if (url) {
        await this.fingerprint.humanDelay(
          delayBetweenPages * 0.8,
          delayBetweenPages * 1.2,
        );
      }
    }

    this.logger.info(`[paginate] done — ${page} pages, ${allItems.length} items`);
    return allItems;
  }

  async login(url, formData = {}, options = {}) {
    const body = new URLSearchParams(formData).toString();
    const res  = await this._fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(options.headers ?? {}) },
      body,
    });

    const ok = res.status < 400;
    this.logger[ok ? 'info' : 'warn'](`[login] ${res.status} ${url}`);
    return ok;
  }

  async discover(origin, options = {}) {
    return this.discoverer.run(origin, options);
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
}

module.exports = Ryna;
