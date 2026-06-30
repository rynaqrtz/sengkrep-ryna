const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const { createHttpsAgent, routeHttpThroughProxy } = require('./ProxyTunnel');

class FetchError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name   = 'FetchError';
    this.status = status ?? null;
    this.code   = code   ?? 'FETCH_ERROR';
  }
}

class TimeoutError extends FetchError {
  constructor(message) {
    super(message, null, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

class CanceledError extends FetchError {
  constructor(message) {
    super(message, null, 'CANCELED');
    this.name = 'CanceledError';
  }
}

class Fetcher {
  constructor(options = {}) {
    this.timeout       = options.timeout       ?? 30000;
    this.maxRedirects   = options.maxRedirects   ?? 5;
    this.fingerprint    = options.fingerprint    ?? null;
    this.cookieJar      = options.cookieJar      ?? null;
    this.interceptors   = options.interceptors   ?? null;
  }

  _decompress(res, chunks) {
    return new Promise((resolve, reject) => {
      const enc    = res.headers['content-encoding'];
      const buffer = Buffer.concat(chunks);

      const done = (err, result) => {
        if (err) return reject(new FetchError(`Decompress failed: ${err.message}`, null, 'DECOMPRESS_ERROR'));
        resolve(result.toString('utf8'));
      };

      if (enc === 'gzip')    return zlib.gunzip(buffer, done);
      if (enc === 'br')      return zlib.brotliDecompress(buffer, done);
      if (enc === 'deflate') return zlib.inflate(buffer, done);
      resolve(buffer.toString('utf8'));
    });
  }

  _rawFetch(url, config, hops = 0) {
    return new Promise((resolve, reject) => {
      if (hops > this.maxRedirects) {
        return reject(new FetchError('Max redirects exceeded', null, 'TOO_MANY_REDIRECTS'));
      }

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return reject(new FetchError(`Invalid URL: ${url}`, null, 'INVALID_URL'));
      }

      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const headers = this.fingerprint
        ? this.fingerprint.buildHeaders(config.headers ?? {})
        : { 'User-Agent': 'sengkrep-ryna/2.0.0', ...(config.headers ?? {}) };

      if (this.cookieJar && !headers['Cookie']) {
        const cookieHeader = this.cookieJar.getCookieHeader(parsed.hostname);
        if (cookieHeader) headers['Cookie'] = cookieHeader;
      }

      let reqOptions = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     `${parsed.pathname}${parsed.search}`,
        method:   config.method ?? 'GET',
        headers,
        timeout:  config.timeout ?? this.timeout,
      };

      if (config.proxy) {
        if (isHttps) {
          reqOptions.agent = createHttpsAgent(config.proxy);
        } else {
          reqOptions = routeHttpThroughProxy(reqOptions, url, config.proxy);
        }
      }

      if (config.rejectUnauthorized === false) {
        reqOptions.rejectUnauthorized = false;
      }

      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        fn(arg);
      };

      const req = lib.request(reqOptions, (res) => {
        const { statusCode, headers: resHeaders } = res;

        if (this.cookieJar && resHeaders['set-cookie']) {
          this.cookieJar.setFromHeaders(parsed.hostname, resHeaders['set-cookie']);
        }

        if ([301, 302, 303, 307, 308].includes(statusCode) && resHeaders.location) {
          res.resume();
          let nextConfig = config;
          if ([301, 302, 303].includes(statusCode) && !['GET', 'HEAD'].includes(config.method)) {
            nextConfig = { ...config, method: 'GET', body: null };
          }
          try {
            const next = new URL(resHeaders.location, url).href;
            return finish(resolve, this._rawFetch(next, nextConfig, hops + 1));
          } catch {
            return finish(reject, new FetchError(`Bad redirect location: ${resHeaders.location}`, statusCode, 'BAD_REDIRECT'));
          }
        }

        if (statusCode >= 400) {
          res.resume();
          return finish(reject, new FetchError(`HTTP ${statusCode}`, statusCode, 'HTTP_ERROR'));
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', async () => {
          try {
            const body = await this._decompress(res, chunks);
            finish(resolve, { status: statusCode, headers: resHeaders, body, url });
          } catch (e) {
            finish(reject, e);
          }
        });
        res.on('error', err => finish(reject, new FetchError(err.message, null, 'STREAM_ERROR')));
      });

      req.on('timeout', () => {
        req.destroy();
        finish(reject, new TimeoutError('Request timed out'));
      });

      if (config.signal) {
        const onAbort = () => {
          req.destroy();
          finish(reject, new CanceledError('Request canceled'));
        };
        if (config.signal.aborted) {
          onAbort();
        } else {
          config.signal.addEventListener('abort', onAbort, { once: true });
        }
      }

      req.on('error', (err) => {
        if (err.code === 'PROXY_ERROR') return finish(reject, err);
        finish(reject, new FetchError(err.message, null, 'NETWORK_ERROR'));
      });

      if (config.body) req.write(config.body);
      req.end();
    });
  }

  async fetch(url, options = {}) {
    let config = {
      method:             options.method             ?? 'GET',
      headers:            options.headers             ?? {},
      body:               options.body                ?? null,
      proxy:              options.proxy               ?? null,
      signal:             options.signal               ?? null,
      timeout:            options.timeout             ?? this.timeout,
      rejectUnauthorized: options.rejectUnauthorized   ?? undefined,
    };

    if (this.interceptors) {
      config = await this.interceptors.request.run({ url, ...config });
      url    = config.url;
    }

    try {
      const raw = await this._rawFetch(url, config, 0);
      if (this.interceptors) return await this.interceptors.response.run(raw);
      return raw;
    } catch (err) {
      if (this.interceptors) return await this.interceptors.response.runError(err);
      throw err;
    }
  }
}

module.exports = { Fetcher, FetchError, TimeoutError, CanceledError };
