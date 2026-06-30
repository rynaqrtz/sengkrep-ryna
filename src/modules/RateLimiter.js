class RateLimiter {
  constructor(options = {}) {
    this.requestsPerSecond = options.requestsPerSecond ?? null;
    this.concurrency       = options.concurrency       ?? null;
    this._lastRequest      = new Map();
    this._active           = new Map();
    this._queue            = new Map();
  }

  get enabled() {
    return this.requestsPerSecond !== null || this.concurrency !== null;
  }

  async _waitForInterval(hostname) {
    if (!this.requestsPerSecond) return;
    const minInterval = 1000 / this.requestsPerSecond;
    const last         = this._lastRequest.get(hostname) ?? 0;
    const elapsed       = Date.now() - last;

    if (elapsed < minInterval) {
      await new Promise(r => setTimeout(r, minInterval - elapsed));
    }
    this._lastRequest.set(hostname, Date.now());
  }

  async _waitForSlot(hostname) {
    if (!this.concurrency) return;

    if (!this._active.has(hostname)) this._active.set(hostname, 0);

    while (this._active.get(hostname) >= this.concurrency) {
      await new Promise(r => {
        if (!this._queue.has(hostname)) this._queue.set(hostname, []);
        this._queue.get(hostname).push(r);
      });
    }

    this._active.set(hostname, this._active.get(hostname) + 1);
  }

  _releaseSlot(hostname) {
    if (!this.concurrency) return;
    const current = this._active.get(hostname) ?? 1;
    this._active.set(hostname, Math.max(0, current - 1));

    const queue = this._queue.get(hostname);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      next();
    }
  }

  async acquire(hostname) {
    await this._waitForSlot(hostname);
    await this._waitForInterval(hostname);
    return () => this._releaseSlot(hostname);
  }
}

module.exports = RateLimiter;
