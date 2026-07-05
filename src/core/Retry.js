const STRATEGIES = {
  429: { baseDelay: 5000,  multiplier: 2.0, maxDelay: 120000 },
  403: { baseDelay: 8000,  multiplier: 2.0, maxDelay: 60000  },
  503: { baseDelay: 3000,  multiplier: 1.5, maxDelay: 30000  },
  502: { baseDelay: 2000,  multiplier: 1.5, maxDelay: 20000  },
  504: { baseDelay: 2000,  multiplier: 1.5, maxDelay: 20000  },
  500: { baseDelay: 1500,  multiplier: 1.5, maxDelay: 15000  },
  408: { baseDelay: 1000,  multiplier: 1.2, maxDelay: 10000  },
  default: { baseDelay: 1000, multiplier: 1.5, maxDelay: 15000 },
};

class Retry {
  constructor(options = {}) {
    this.max              = options.max              ?? 3;
    this.jitter           = options.jitter           ?? true;
    this.retryOn          = options.retryOn          ?? [408, 429, 500, 502, 503, 504, 403];
    this.retryOnNetwork   = options.retryOnNetwork   ?? true;
    this.retryOnTimeout   = options.retryOnTimeout   ?? true;
    this.onRetry          = options.onRetry          ?? null;
  }

  _applyJitter(ms) {
    if (!this.jitter) return ms;
    return ms * (0.65 + Math.random() * 0.7);
  }

  _delay(status, attempt) {
    const s   = STRATEGIES[status] ?? STRATEGIES.default;
    const raw = s.baseDelay * Math.pow(s.multiplier, attempt - 1);
    return Math.round(this._applyJitter(Math.min(raw, s.maxDelay)));
  }

  _shouldRetry(err, retryCount) {
    if (err.code === 'CANCELED') return false;
    if (retryCount > this.max) return false;
    if (err.code === 'NETWORK_ERROR' && this.retryOnNetwork)  return true;
    if (err.code === 'TIMEOUT'       && this.retryOnTimeout)  return true;
    if (err.status && this.retryOn.includes(err.status))      return true;
    return false;
  }

  async run(fn) {
    let attempt   = 0;
    let lastError = null;

    while (attempt <= this.max) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;
        attempt++;

        if (!this._shouldRetry(err, attempt)) throw err;

        const wait = this._delay(err.status, attempt);

        if (this.onRetry) {
          this.onRetry({ attempt, status: err.status, code: err.code, waitMs: wait });
        }

        await new Promise(r => setTimeout(r, wait));
      }
    }

    throw lastError;
  }
}

module.exports = Retry;
