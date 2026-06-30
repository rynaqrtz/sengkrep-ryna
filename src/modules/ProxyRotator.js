class ProxyRotator {
  constructor(options = {}) {
    this.proxies  = options.proxies  ?? [];
    this.strategy = options.strategy ?? 'round-robin';
    this._index   = 0;
    this._sticky  = new Map();
    this._failures = new Map();
    this.maxFailures = options.maxFailures ?? 3;
  }

  get enabled() {
    return this.proxies.length > 0;
  }

  _healthyPool() {
    if (this._failures.size === 0) return this.proxies;
    const pool = this.proxies.filter(p => (this._failures.get(p) ?? 0) < this.maxFailures);
    return pool.length > 0 ? pool : this.proxies;
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  next(hostname = '') {
    if (!this.enabled) return null;
    const pool = this._healthyPool();

    if (this.strategy === 'sticky') {
      if (this._sticky.has(hostname)) {
        const cached = this._sticky.get(hostname);
        if (pool.includes(cached)) return cached;
      }
      const proxy = pool[this._hash(hostname) % pool.length];
      this._sticky.set(hostname, proxy);
      return proxy;
    }

    if (this.strategy === 'random') {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    const proxy = pool[this._index % pool.length];
    this._index++;
    return proxy;
  }

  reportFailure(proxyUrl) {
    const count = (this._failures.get(proxyUrl) ?? 0) + 1;
    this._failures.set(proxyUrl, count);
  }

  reportSuccess(proxyUrl) {
    if (this._failures.has(proxyUrl)) this._failures.delete(proxyUrl);
  }

  stats() {
    return this.proxies.map(p => ({
      proxy:    p,
      failures: this._failures.get(p) ?? 0,
      healthy:  (this._failures.get(p) ?? 0) < this.maxFailures,
    }));
  }
}

module.exports = ProxyRotator;
