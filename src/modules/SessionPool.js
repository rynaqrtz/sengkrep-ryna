const CookieJar   = require('./CookieJar');
const Fingerprint = require('./Fingerprint');

class SessionPool {
  constructor(options = {}) {
    this.size          = Math.max(1, options.size ?? 1);
    this.strategy       = options.strategy       ?? 'round-robin';
    this.recycleAfter    = options.recycleAfter    ?? null;
    this.fingerprintOpts = options.fingerprint     ?? {};
    this._sessions       = Array.from({ length: this.size }, (_, i) => this._create(i));
    this._cursor         = 0;
  }

  _create(id) {
    return {
      id,
      cookieJar:   new CookieJar(),
      fingerprint: new Fingerprint(this.fingerprintOpts),
      useCount:    0,
      createdAt:   Date.now(),
    };
  }

  _recycle(session) {
    session.cookieJar   = new CookieJar();
    session.fingerprint = new Fingerprint(this.fingerprintOpts);
    session.useCount    = 0;
    session.createdAt   = Date.now();
  }

  _leastUsed() {
    return this._sessions.reduce((min, s) => (s.useCount < min.useCount ? s : min), this._sessions[0]);
  }

  next() {
    const session = this.strategy === 'least-used'
      ? this._leastUsed()
      : this._sessions[this._cursor++ % this._sessions.length];

    session.useCount++;

    if (this.recycleAfter && session.useCount >= this.recycleAfter) {
      this._recycle(session);
    }

    return session;
  }

  get(id) {
    return this._sessions.find(s => s.id === id) ?? null;
  }

  stats() {
    return this._sessions.map(s => ({ id: s.id, useCount: s.useCount, createdAt: s.createdAt }));
  }

  resetAll() {
    this._sessions.forEach(s => this._recycle(s));
  }
}

module.exports = SessionPool;
