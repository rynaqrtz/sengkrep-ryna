const dns = require('dns');

class DnsCache {
  constructor(options = {}) {
    this.ttl      = options.ttl      ?? 300000;
    this.enabled  = options.enabled  ?? true;
    this._store   = new Map();
    this._cursor  = new Map();
  }

  _resolve(hostname) {
    return new Promise((resolve, reject) => {
      dns.resolve4(hostname, (err, addresses) => {
        if (!err && addresses.length > 0) return resolve(addresses);
        dns.lookup(hostname, { all: true }, (err2, results) => {
          if (err2) return reject(err2);
          resolve(results.map(r => r.address));
        });
      });
    });
  }

  async lookup(hostname) {
    if (!this.enabled) return hostname;

    const cached = this._store.get(hostname);
    if (cached && Date.now() - cached.ts < this.ttl) {
      return this._pick(hostname, cached.addresses);
    }

    try {
      const addresses = await this._resolve(hostname);
      this._store.set(hostname, { addresses, ts: Date.now() });
      return this._pick(hostname, addresses);
    } catch {
      return hostname;
    }
  }

  _pick(hostname, addresses) {
    if (addresses.length === 1) return addresses[0];
    const idx = (this._cursor.get(hostname) ?? 0) % addresses.length;
    this._cursor.set(hostname, idx + 1);
    return addresses[idx];
  }

  invalidate(hostname) {
    if (hostname) {
      this._store.delete(hostname);
    } else {
      this._store.clear();
    }
  }

  stats() {
    return [...this._store.entries()].map(([hostname, entry]) => ({
      hostname,
      addresses: entry.addresses,
      ageMs:     Date.now() - entry.ts,
    }));
  }
}

module.exports = DnsCache;
