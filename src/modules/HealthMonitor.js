class HealthMonitor {
  constructor(options = {}) {
    this.alertThreshold = options.alertThreshold ?? 0.5;
    this.windowSize     = options.windowSize     ?? 10;
    this.onAlert        = options.onAlert        ?? null;
    this._store         = new Map();
  }

  _key(url) {
    return url;
  }

  record(url, healthMap) {
    const key = this._key(url);
    if (!this._store.has(key)) this._store.set(key, {});
    const history = this._store.get(key);

    for (const [field, info] of Object.entries(healthMap)) {
      if (!history[field]) {
        history[field] = { selector: info.selector, runs: [] };
      }
      history[field].runs.push({
        ts:              Date.now(),
        empty:           info.empty,
        count:           info.count,
        patternMismatch: info.patternMismatch ?? false,
      });
      if (history[field].runs.length > this.windowSize) {
        history[field].runs.shift();
      }
    }

    return this._analyze(url, history);
  }

  _analyze(url, history) {
    const alerts = [];

    for (const [field, data] of Object.entries(history)) {
      const runs = data.runs;
      if (runs.length < 2) continue;

      const emptyRate = runs.filter(r => r.empty).length / runs.length;

      if (emptyRate >= this.alertThreshold) {
        alerts.push({
          field,
          selector:  data.selector,
          type:      'high_empty_rate',
          emptyRate: Math.round(emptyRate * 100),
          lastSeen:  runs.find(r => !r.empty)?.ts ?? null,
          message:   `Selector "${data.selector}" empty in ${Math.round(emptyRate * 100)}% of recent runs`,
        });
      }

      const nonEmptyCounts = runs.filter(r => !r.empty).map(r => r.count);
      if (nonEmptyCounts.length >= 3) {
        const avg    = nonEmptyCounts.reduce((a, b) => a + b, 0) / nonEmptyCounts.length;
        const latest = nonEmptyCounts[nonEmptyCounts.length - 1];
        if (latest < avg * 0.35 && avg > 1) {
          alerts.push({
            field,
            selector: data.selector,
            type:     'count_drop',
            expected: Math.round(avg),
            actual:   latest,
            message:  `"${field}" count dropped: avg ${Math.round(avg)} → ${latest}`,
          });
        }
      }

      const mismatchRate = runs.filter(r => r.patternMismatch).length / runs.length;
      if (mismatchRate >= this.alertThreshold) {
        alerts.push({
          field,
          selector:     data.selector,
          type:         'pattern_mismatch',
          mismatchRate: Math.round(mismatchRate * 100),
          message:      `"${field}" pattern mismatch in ${Math.round(mismatchRate * 100)}% of runs`,
        });
      }
    }

    const report = { url, alerts, healthy: alerts.length === 0 };
    if (!report.healthy && this.onAlert) this.onAlert(report);
    return report;
  }

  getReport(url) {
    const history = this._store.get(this._key(url));
    if (!history) return null;

    const fields = {};
    for (const [field, data] of Object.entries(history)) {
      const runs      = data.runs;
      const nonEmpty  = runs.filter(r => !r.empty);
      const emptyRate = runs.filter(r => r.empty).length / runs.length;
      fields[field]   = {
        selector:  data.selector,
        totalRuns: runs.length,
        emptyRate: Math.round(emptyRate * 100),
        avgCount:  nonEmpty.length > 0
          ? Math.round(nonEmpty.reduce((a, r) => a + r.count, 0) / nonEmpty.length)
          : 0,
        lastRun:   runs.at(-1)?.ts ?? null,
      };
    }

    return { url, fields };
  }

  getAllReports() {
    return [...this._store.keys()].map(url => this.getReport(url));
  }

  reset(url) {
    if (url) {
      this._store.delete(url);
    } else {
      this._store.clear();
    }
  }
}

module.exports = HealthMonitor;
