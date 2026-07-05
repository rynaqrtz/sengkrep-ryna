const Storage = require('../utils/storage');

class Cache {
  constructor(options = {}) {
    this.ttl      = options.ttl      ?? 3600;
    this.maxItems = options.maxItems ?? 1000;
    this.disk     = options.storage === 'disk';
    this._mem     = new Map();
    this._stats   = { hits: 0, misses: 0, sets: 0 };

    if (this.disk) {
      this._store = new Storage(options.storageDir ?? '.sengkrep-ryna-cache');
    }
  }

  _key(url, method = 'GET') {
    return `${method}:${url}`;
  }

  get(url, method = 'GET') {
    const key = this._key(url, method);

    if (this.disk) {
      const entry = this._store.get(key);
      if (!entry) { this._stats.misses++; return null; }
      if (Date.now() - entry.ts > this.ttl * 1000) {
        this._store.delete(key);
        this._stats.misses++;
        return null;
      }
      this._stats.hits++;
      return entry.data;
    }

    const entry = this._mem.get(key);
    if (!entry) { this._stats.misses++; return null; }
    if (Date.now() - entry.ts > this.ttl * 1000) {
      this._mem.delete(key);
      this._stats.misses++;
      return null;
    }
    this._stats.hits++;
    return entry.data;
  }

  set(url, data, method = 'GET') {
    const key = this._key(url, method);
    this._stats.sets++;

    if (this.disk) {
      this._store.set(key, data);
      return;
    }

    if (this._mem.size >= this.maxItems && !this._mem.has(key)) {
      const oldestKey = this._mem.keys().next().value;
      this._mem.delete(oldestKey);
    }

    this._mem.set(key, { ts: Date.now(), data });
  }

  has(url, method = 'GET') {
    return this.get(url, method) !== null;
  }

  delete(url, method = 'GET') {
    const key = this._key(url, method);
    if (this.disk) {
      this._store.delete(key);
    } else {
      this._mem.delete(key);
    }
  }

  clear() {
    if (this.disk) {
      this._store.clear();
    } else {
      this._mem.clear();
    }
  }

  stats() {
    const size = this.disk ? this._store.list().length : this._mem.size;
    return { ...this._stats, size, hitRate: this._stats.hits + this._stats.misses > 0
      ? Math.round((this._stats.hits / (this._stats.hits + this._stats.misses)) * 100)
      : 0 };
  }
}

module.exports = Cache;
