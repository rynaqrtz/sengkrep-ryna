const Storage = require('../utils/storage');

class Incremental {
  constructor(options = {}) {
    this.storage = new Storage(options.storageDir ?? '.sengkrep-ryna-incremental');
  }

  getConditionalHeaders(url) {
    const entry = this.storage.get(url);
    if (!entry) return {};

    const headers = {};
    if (entry.data.etag)         headers['If-None-Match']     = entry.data.etag;
    if (entry.data.lastModified) headers['If-Modified-Since'] = entry.data.lastModified;
    return headers;
  }

  hasSnapshot(url) {
    return this.storage.get(url) !== null;
  }

  getSnapshot(url) {
    const entry = this.storage.get(url);
    return entry ? entry.data.extracted : null;
  }

  record(url, responseHeaders, extracted) {
    this.storage.set(url, {
      etag:         responseHeaders['etag']          ?? null,
      lastModified: responseHeaders['last-modified'] ?? null,
      extracted:    extracted ?? null,
    });
  }

  clear(url) {
    if (url) {
      this.storage.delete(url);
    } else {
      this.storage.clear();
    }
  }
}

module.exports = Incremental;
