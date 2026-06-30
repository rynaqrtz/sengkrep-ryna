const Storage = require('../utils/storage');

const SEVERITY = { info: 0, warn: 1, critical: 2 };

class DiffDetector {
  constructor(options = {}) {
    this.storage     = new Storage(options.storageDir ?? '.sengkrep-ryna');
    this.onDiff      = options.onDiff      ?? null;
    this.sensitivity = options.sensitivity ?? 'structural';
  }

  _structOf(data) {
    if (Array.isArray(data)) {
      return {
        kind:     'array',
        length:   data.length,
        itemKeys: data[0] && typeof data[0] === 'object' ? Object.keys(data[0]).sort() : [],
      };
    }
    if (data !== null && typeof data === 'object') {
      return {
        kind:       'object',
        keys:       Object.keys(data).sort(),
        nullFields: Object.entries(data).filter(([, v]) => v === null || v === '').map(([k]) => k).sort(),
      };
    }
    return { kind: typeof data };
  }

  _diff(prev, curr) {
    const changes  = [];
    const ps       = this._structOf(prev);
    const cs       = this._structOf(curr);

    if (ps.kind !== cs.kind) {
      changes.push({ type: 'type_changed', from: ps.kind, to: cs.kind, severity: 'critical' });
      return changes;
    }

    if (ps.kind === 'object') {
      const added   = cs.keys.filter(k => !ps.keys.includes(k));
      const removed = ps.keys.filter(k => !cs.keys.includes(k));

      if (added.length > 0) {
        changes.push({ type: 'keys_added',   keys: added,   severity: 'info' });
      }
      if (removed.length > 0) {
        changes.push({ type: 'keys_removed', keys: removed, severity: 'critical' });
      }

      const becameNull  = cs.nullFields.filter(k => !ps.nullFields.includes(k));
      const recovered   = ps.nullFields.filter(k => !cs.nullFields.includes(k));

      if (becameNull.length > 0) {
        changes.push({ type: 'fields_became_null', fields: becameNull, severity: 'warn' });
      }
      if (recovered.length > 0) {
        changes.push({ type: 'fields_recovered', fields: recovered, severity: 'info' });
      }

      if (this.sensitivity === 'value') {
        for (const key of ps.keys) {
          if (!removed.includes(key) && JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
            changes.push({
              type:     'value_changed',
              field:    key,
              from:     prev[key],
              to:       curr[key],
              severity: 'info',
            });
          }
        }
      }
    }

    if (ps.kind === 'array') {
      const delta = cs.length - ps.length;
      if (delta !== 0) {
        const severity = Math.abs(delta) >= ps.length * 0.5 ? 'warn' : 'info';
        changes.push({ type: 'count_changed', from: ps.length, to: cs.length, delta, severity });
      }

      if (JSON.stringify(ps.itemKeys) !== JSON.stringify(cs.itemKeys)) {
        changes.push({ type: 'item_schema_changed', from: ps.itemKeys, to: cs.itemKeys, severity: 'critical' });
      }
    }

    return changes;
  }

  check(url, data) {
    const stored = this.storage.get(url);
    this.storage.set(url, data);

    if (!stored) {
      return { url, firstRun: true, changes: [], hasCritical: false, previousTs: null };
    }

    const changes     = this._diff(stored.data, data);
    const hasCritical = changes.some(c => SEVERITY[c.severity] >= SEVERITY.critical);
    const hasWarn     = changes.some(c => SEVERITY[c.severity] >= SEVERITY.warn);

    const result = {
      url,
      firstRun:    false,
      changes,
      hasCritical,
      hasWarn,
      previousTs:  stored.ts,
      snapshotAge: Math.round((Date.now() - stored.ts) / 1000),
    };

    if (changes.length > 0 && this.onDiff) this.onDiff(result);

    return result;
  }

  clearSnapshot(url) {
    this.storage.delete(url);
  }

  clearAll() {
    this.storage.clear();
  }
}

module.exports = DiffDetector;
