const fs = require('fs');

class HarRecorder {
  constructor() {
    this.entries  = [];
    this._pending = new Map();
  }

  attach(interceptors) {
    interceptors.request.use((config) => {
      this._pending.set(config.url, { startedAt: Date.now(), config });
      return config;
    });

    interceptors.response.use(
      (res) => { this._finish(res.url, res, null); return res; },
      (err) => { this._finish(err.url ?? '(unknown)', null, err); throw err; },
    );

    return this;
  }

  _finish(url, res, err) {
    const pending = this._pending.get(url);
    const time    = pending ? Date.now() - pending.startedAt : 0;
    this._pending.delete(url);

    this.entries.push({
      startedDateTime: new Date(pending?.startedAt ?? Date.now()).toISOString(),
      time,
      request: {
        method:      pending?.config?.method ?? 'GET',
        url,
        httpVersion: 'HTTP/1.1',
        headers:     Object.entries(pending?.config?.headers ?? {}).map(([name, value]) => ({ name, value: String(value) })),
        queryString: [],
        headersSize: -1,
        bodySize:    pending?.config?.body ? Buffer.byteLength(pending.config.body) : 0,
      },
      response: {
        status:      res?.status ?? err?.status ?? 0,
        statusText:  err ? (err.message ?? 'Error') : 'OK',
        httpVersion: 'HTTP/1.1',
        headers:     Object.entries(res?.headers ?? {}).map(([name, value]) => ({ name, value: String(value) })),
        content:     { size: res?.body ? Buffer.byteLength(res.body) : 0, mimeType: res?.headers?.['content-type'] ?? 'text/plain' },
        headersSize: -1,
        bodySize:    res?.body ? Buffer.byteLength(res.body) : 0,
      },
      cache: {},
      timings: { send: 0, wait: time, receive: 0 },
    });
  }

  toHAR() {
    return {
      log: {
        version: '1.2',
        creator: { name: 'sengkrep-ryna', version: '3.0.0' },
        entries: this.entries,
      },
    };
  }

  save(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.toHAR(), null, 2), 'utf8');
  }

  clear() {
    this.entries = [];
    this._pending.clear();
  }
}

module.exports = HarRecorder;
