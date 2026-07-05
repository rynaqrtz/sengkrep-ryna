const STATE = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

class CircuitOpenError extends Error {
  constructor(key, retryAt) {
    super(`Circuit open for "${key}", retry after ${new Date(retryAt).toISOString()}`);
    this.name    = 'CircuitOpenError';
    this.code    = 'CIRCUIT_OPEN';
    this.key     = key;
    this.retryAt = retryAt;
  }
}

class CircuitBreaker {
  constructor(options = {}) {
    this.threshold          = options.threshold          ?? 5;
    this.cooldown           = options.cooldown           ?? 60000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 1;
    this.onOpen             = options.onOpen             ?? null;
    this.onClose            = options.onClose            ?? null;
    this._now               = options.clock              ?? (() => Date.now());
    this._store             = new Map();
  }

  _get(key) {
    if (!this._store.has(key)) {
      this._store.set(key, { state: STATE.CLOSED, failures: 0, openedAt: null, halfOpenAttempts: 0 });
    }
    return this._store.get(key);
  }

  _transitionIfDue(key) {
    const entry = this._get(key);
    if (entry.state === STATE.OPEN && this._now() - entry.openedAt >= this.cooldown) {
      entry.state            = STATE.HALF_OPEN;
      entry.halfOpenAttempts = 0;
    }
    return entry;
  }

  canRequest(key) {
    const entry = this._transitionIfDue(key);
    if (entry.state === STATE.CLOSED) return true;
    if (entry.state === STATE.HALF_OPEN) return entry.halfOpenAttempts < this.halfOpenMaxAttempts;
    return false;
  }

  assertCanRequest(key) {
    if (this.canRequest(key)) return;
    const entry = this._get(key);
    throw new CircuitOpenError(key, entry.openedAt + this.cooldown);
  }

  recordSuccess(key) {
    const entry = this._get(key);
    const wasOpen = entry.state !== STATE.CLOSED;
    entry.state            = STATE.CLOSED;
    entry.failures          = 0;
    entry.openedAt          = null;
    entry.halfOpenAttempts = 0;
    if (wasOpen && this.onClose) this.onClose({ key });
  }

  recordFailure(key) {
    const entry = this._transitionIfDue(key);

    if (entry.state === STATE.HALF_OPEN) {
      entry.halfOpenAttempts++;
      entry.state    = STATE.OPEN;
      entry.openedAt = this._now();
      if (this.onOpen) this.onOpen({ key, failures: entry.failures });
      return;
    }

    entry.failures++;
    if (entry.failures >= this.threshold) {
      const wasClosed = entry.state === STATE.CLOSED;
      entry.state    = STATE.OPEN;
      entry.openedAt = this._now();
      if (wasClosed && this.onOpen) this.onOpen({ key, failures: entry.failures });
    }
  }

  getState(key) {
    const entry = this._transitionIfDue(key);
    return { key, state: entry.state, failures: entry.failures, openedAt: entry.openedAt };
  }

  getAllStates() {
    return [...this._store.keys()].map(k => this.getState(k));
  }

  reset(key) {
    if (key) {
      this._store.delete(key);
    } else {
      this._store.clear();
    }
  }
}

module.exports = { CircuitBreaker, CircuitOpenError, STATE };
