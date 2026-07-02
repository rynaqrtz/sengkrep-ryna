const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const { createHttpsAgent, routeHttpThroughProxy } = require('./ProxyTunnel');
const contentSafety = require('../utils/contentSafety');

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

function decompressStream(encoding) {
  if (encoding === 'gzip')    return zlib.createGunzip();
  if (encoding === 'br')      return zlib.createBrotliDecompress();
  if (encoding === 'deflate') return zlib.createInflate();
  if (encoding === 'zstd' && zlib.createZstdDecompress) return zlib.createZstdDecompress();
  return null;
}

class Fetcher {
  constructor(options = {}) {
    this.timeout          = options.timeout          ?? 30000;
    this.maxRedirects      = options.maxRedirects      ?? 5;
    this.fingerprint       = options.fingerprint       ?? null;
    this.cookieJar         = options.cookieJar         ?? null;
    this.interceptors      = options.interceptors      ?? null;
    this.maxMemoryBuffer   = options.maxMemoryBuffer   ?? 10 * 1024 * 1024;
    this.streamDir         = options.streamDir         ?? os.tmpdir();
    this.keepAlive         = options.keepAlive         ?? true;
    this.onProgress        = options.onProgress        ?? null;
    this.dnsCache          = options.dnsCache          ?? null;

    this.httpAgent  = new http.Agent({ keepAlive: this.keepAlive, maxSockets: options.maxSockets ?? 50 });
    this.httpsAgent = new https.Agent({ keepAlive: this.keepAlive, maxSockets: options.maxSockets ?? 50 });
  }

  _consumeBody(res, config) {
    return new Promise((resolve, reject) => {
      const encoding    = res.headers['content-encoding'];
      const transform    = decompressStream(encoding);
      const source        = transform ? res.pipe(transform) : res;

      let chunks       = [];
      let bufferedSize = 0;
      let fileStream   = null;
      let filePath     = null;
      let totalSize    = 0;
      let settled      = false;

      const finish = (err, result) => {
        if (settled) return;
        settled = true;
        if (fileStream) fileStream.end();
        if (err) return reject(err);
        resolve(result);
      };

      source.on('data', (chunk) => {
        totalSize += chunk.length;

        if (this.onProgress) this.onProgress({ url: config.url, bytesReceived: totalSize });

        if (fileStream) {
          fileStream.write(chunk);
          return;
        }

        chunks.push(chunk);
        bufferedSize += chunk.length;

        if (bufferedSize > this.maxMemoryBuffer && config.bufferAll !== true) {
          filePath   = path.join(this.streamDir, `ryna-stream-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
          fileStream = fs.createWriteStream(filePath);
          for (const c of chunks) fileStream.write(c);
          chunks = [];
        }
      });

      source.on('end', () => {
        if (fileStream) {
          fileStream.end(() => finish(null, { streamed: true, filePath, size: totalSize }));
        } else {
          finish(null, { streamed: false, buffer: Buffer.concat(chunks), size: totalSize });
        }
      });

      source.on('error', (err) => finish(new FetchError(`Decompress/stream failed: ${err.message}`, null, 'DECOMPRESS_ERROR')));
      res.on('error', (err) => finish(new FetchError(err.message, null, 'STREAM_ERROR')));
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
        : { 'User-Agent': 'sengkrep-ryna/3.0.0', ...(config.headers ?? {}) };

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
        agent:    isHttps ? this.httpsAgent : this.httpAgent,
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

      if (this.dnsCache) {
        reqOptions.lookup = (hostname, opts, callback) => {
          this.dnsCache.lookup(hostname)
            .then((address) => callback(null, address, address.includes(':') ? 6 : 4))
            .catch((err) => callback(err));
        };
      }

      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        fn(arg);
      };

      const requestSize = config.body ? Buffer.byteLength(config.body) : 0;

      const req = lib.request(reqOptions, async (res) => {
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

        if (statusCode === 304) {
          res.resume();
          return finish(resolve, { status: statusCode, headers: resHeaders, body: '', url, notModified: true, requestSize, responseSize: 0 });
        }

        if (statusCode >= 400) {
          res.resume();
          return finish(reject, new FetchError(`HTTP ${statusCode}`, statusCode, 'HTTP_ERROR'));
        }

        try {
          const consumed = await this._consumeBody(res, { ...config, url });

          if (consumed.streamed) {
            return finish(resolve, {
              status: statusCode, headers: resHeaders, url,
              body: '', streamed: true, filePath: consumed.filePath,
              requestSize, responseSize: consumed.size,
            });
          }

          const safety = contentSafety.inspect(consumed.buffer, resHeaders['content-type']);

          if (safety.isBinary) {
            return finish(resolve, {
              status: statusCode, headers: resHeaders, url,
              body: '', binary: true, bodyBuffer: consumed.buffer,
              sniffedType: safety.sniffedType, requestSize, responseSize: consumed.size,
            });
          }

          const decoded = contentSafety.decodeBuffer(consumed.buffer, {
            headerCharset: contentSafety.detectCharsetFromContentType(resHeaders['content-type']),
          });

          finish(resolve, {
            status: statusCode, headers: resHeaders, url,
            body: decoded.text, charset: decoded.charset, charsetSource: decoded.source,
            requestSize, responseSize: consumed.size,
          });
        } catch (e) {
          finish(reject, e);
        }
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
      bufferAll:          options.bufferAll            ?? false,
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
