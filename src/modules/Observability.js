const http = require('http');

class Observability {
  constructor(options = {}) {
    this.enabled = options.enabled ?? false;
    this.port    = options.port    ?? null;
    this._stats  = {
      total: 0, success: 0, failed: 0,
      startedAt: Date.now(),
      domains: {},
      errors: {},
      categories: { network: 0, timeout: 0, http4xx: 0, http5xx: 0, validation: 0, security: 0, circuit: 0, other: 0 },
      bytes: { sent: 0, received: 0 },
    };
    this._server = null;

    if (this.enabled && this.port) this._startServer();
  }

  _categorize(err) {
    if (!err) return 'other';
    if (err.code === 'TIMEOUT') return 'timeout';
    if (err.code === 'NETWORK_ERROR') return 'network';
    if (err.code === 'SECURITY_BLOCKED') return 'security';
    if (err.code === 'CIRCUIT_OPEN') return 'circuit';
    if (err.name === 'ValidationError') return 'validation';
    if (err.status >= 500) return 'http5xx';
    if (err.status >= 400) return 'http4xx';
    return 'other';
  }

  trackBytes(sent, received) {
    this._stats.bytes.sent     += sent ?? 0;
    this._stats.bytes.received += received ?? 0;
  }

  _domainOf(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  recordSuccess(url) {
    this._stats.total++;
    this._stats.success++;
    const domain = this._domainOf(url);
    this._stats.domains[domain] ??= { requests: 0, success: 0, failed: 0 };
    this._stats.domains[domain].requests++;
    this._stats.domains[domain].success++;
  }

  recordFailure(url, err) {
    this._stats.total++;
    this._stats.failed++;
    const domain = this._domainOf(url);
    this._stats.domains[domain] ??= { requests: 0, success: 0, failed: 0 };
    this._stats.domains[domain].requests++;
    this._stats.domains[domain].failed++;

    const code = err?.code ?? err?.status ?? 'UNKNOWN';
    this._stats.errors[code] = (this._stats.errors[code] ?? 0) + 1;

    const category = this._categorize(err);
    this._stats.categories[category] = (this._stats.categories[category] ?? 0) + 1;
  }

  report() {
    const elapsedSec = Math.max(1, (Date.now() - this._stats.startedAt) / 1000);
    return {
      total:       this._stats.total,
      success:     this._stats.success,
      failed:      this._stats.failed,
      successRate: this._stats.total > 0 ? Math.round((this._stats.success / this._stats.total) * 1000) / 10 : 0,
      rps:         Math.round((this._stats.total / elapsedSec) * 100) / 100,
      elapsedSec:  Math.round(elapsedSec),
      domains:     this._stats.domains,
      categories:  this._stats.categories,
      bytes:       this._stats.bytes,
      topErrors:   Object.entries(this._stats.errors).sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count })),
    };
  }

  _startServer() {
    this._server = http.createServer((req, res) => {
      if (req.url === '/api/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(this.report(), null, 2));
      }

      const r = this.report();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><head><title>sengkrep-ryna</title><meta http-equiv="refresh" content="3"></head>
<body style="font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:2rem">
<h1>sengkrep-ryna observability</h1>
<p>total: ${r.total} | success: ${r.success} | failed: ${r.failed} | rate: ${r.successRate}% | rps: ${r.rps}</p>
<pre>${JSON.stringify(r.domains, null, 2)}</pre>
</body></html>`);
    });
    this._server.listen(this.port);
  }

  close() {
    if (this._server) this._server.close();
  }
}

module.exports = Observability;
