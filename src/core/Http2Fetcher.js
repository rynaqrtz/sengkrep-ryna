const http2 = require('http2');
const zlib  = require('zlib');
const contentSafety = require('../utils/contentSafety');

class Http2Error extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'Http2Error';
    this.code = code ?? 'HTTP2_ERROR';
  }
}

function decompressBuffer(buffer, encoding) {
  return new Promise((resolve, reject) => {
    const done = (err, result) => (err ? reject(err) : resolve(result));
    if (!encoding || encoding === 'identity') return resolve(buffer);
    if (encoding === 'gzip')    return zlib.gunzip(buffer, done);
    if (encoding === 'br')      return zlib.brotliDecompress(buffer, done);
    if (encoding === 'deflate') return zlib.inflate(buffer, done);
    if (encoding === 'zstd') {
      if (zlib.zstdDecompress) return zlib.zstdDecompress(buffer, done);
      return reject(new Http2Error(`Content-Encoding "zstd" not supported by this Node runtime (needs 22.15+/23.8+)`, 'UNSUPPORTED_ENCODING'));
    }
    reject(new Http2Error(`Unsupported Content-Encoding: "${encoding}"`, 'UNSUPPORTED_ENCODING'));
  });
}

class Http2Fetcher {
  constructor(options = {}) {
    this.timeout      = options.timeout      ?? 30000;
    this.fingerprint  = options.fingerprint  ?? null;
    this.cookieJar    = options.cookieJar    ?? null;
    this.maxRedirects = options.maxRedirects ?? 5;
    this._sessions    = new Map();
  }

  _originOf(parsed) {
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? 443 : 80)}`;
  }

  _getSession(origin, options) {
    const existing = this._sessions.get(origin);
    if (existing && !existing.closed && !existing.destroyed) return existing;

    const session = http2.connect(origin, { rejectUnauthorized: options.rejectUnauthorized ?? true });
    session.on('error', () => this._sessions.delete(origin));
    session.on('close', () => this._sessions.delete(origin));
    session.setTimeout(this.timeout, () => session.close());
    this._sessions.set(origin, session);
    return session;
  }

  fetch(url, config = {}, hops = 0) {
    return new Promise((resolve, reject) => {
      if (hops > this.maxRedirects) {
        return reject(new Http2Error('Max redirects exceeded', 'TOO_MANY_REDIRECTS'));
      }

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return reject(new Http2Error(`Invalid URL: ${url}`, 'INVALID_URL'));
      }

      const origin = this._originOf(parsed);
      let session;
      try {
        session = this._getSession(origin, config);
      } catch (err) {
        return reject(new Http2Error(`Session connect failed: ${err.message}`, 'CONNECT_FAILED'));
      }

      const headers = this.fingerprint
        ? this.fingerprint.buildHeaders(config.headers ?? {})
        : { 'user-agent': 'sengkrep-ryna/3.0.0', ...(config.headers ?? {}) };

      delete headers['Connection'];
      delete headers['connection'];

      if (this.cookieJar && !headers['cookie']) {
        const cookieHeader = this.cookieJar.getCookieHeader(parsed.hostname);
        if (cookieHeader) headers['cookie'] = cookieHeader;
      }

      const lowerHeaders = {};
      for (const [k, v] of Object.entries(headers)) lowerHeaders[k.toLowerCase()] = v;

      const reqHeaders = {
        ':method':    config.method ?? 'GET',
        ':path':      `${parsed.pathname}${parsed.search}`,
        ':scheme':    parsed.protocol.replace(':', ''),
        ':authority': parsed.host,
        ...lowerHeaders,
      };

      let req;
      try {
        req = session.request(reqHeaders);
      } catch (err) {
        return reject(new Http2Error(`Request failed: ${err.message}`, 'REQUEST_FAILED'));
      }

      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(arg);
      };

      const timer = setTimeout(() => {
        req.close(http2.constants.NGHTTP2_CANCEL);
        finish(reject, new Http2Error('Request timed out', 'TIMEOUT'));
      }, config.timeout ?? this.timeout);

      let responseHeaders = {};
      const chunks = [];

      req.on('response', (h) => { responseHeaders = h; });

      req.on('data', (chunk) => chunks.push(chunk));

      req.on('end', async () => {
        const status = parseInt(responseHeaders[':status'], 10);

        if (this.cookieJar && responseHeaders['set-cookie']) {
          this.cookieJar.setFromHeaders(parsed.hostname, responseHeaders['set-cookie']);
        }

        if ([301, 302, 303, 307, 308].includes(status) && responseHeaders.location) {
          try {
            const next = new URL(responseHeaders.location, url).href;
            return finish(resolve, await this.fetch(next, config, hops + 1));
          } catch {
            return finish(reject, new Http2Error('Bad redirect location', 'BAD_REDIRECT'));
          }
        }

        if (status >= 400) {
          const err = new Http2Error(`HTTP ${status}`, 'HTTP_ERROR');
          err.status = status;
          return finish(reject, err);
        }

        try {
          const raw     = Buffer.concat(chunks);
          const decoded = await decompressBuffer(raw, responseHeaders['content-encoding']);
          const safety  = contentSafety.inspect(decoded, responseHeaders['content-type']);

          if (safety.isBinary) {
            return finish(resolve, {
              status, headers: responseHeaders, url,
              body: '', binary: true, bodyBuffer: decoded,
              sniffedType: safety.sniffedType, protocol: 'h2',
            });
          }

          const text = contentSafety.decodeBuffer(decoded, {
            headerCharset: contentSafety.detectCharsetFromContentType(responseHeaders['content-type']),
          });

          finish(resolve, { status, headers: responseHeaders, url, body: text.text, charset: text.charset, protocol: 'h2' });
        } catch (err) {
          finish(reject, new Http2Error(`Decompress failed: ${err.message}`, 'DECOMPRESS_ERROR'));
        }
      });

      req.on('error', (err) => finish(reject, new Http2Error(err.message, 'STREAM_ERROR')));

      if (config.body) req.write(config.body);
      req.end();
    });
  }

  closeAll() {
    for (const session of this._sessions.values()) session.close();
    this._sessions.clear();
  }
}

module.exports = { Http2Fetcher, Http2Error };
