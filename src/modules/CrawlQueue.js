const fs   = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class CrawlQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.seed        = Array.isArray(options.seed) ? options.seed : [options.seed];
    this.follow       = options.follow       ?? null;
    this.maxUrls      = options.maxUrls      ?? 1000;
    this.concurrency  = options.concurrency  ?? 3;
    this.stateFile    = options.stateFile    ?? null;
    this.saveEvery    = options.saveEvery    ?? 5;

    this._visited  = new Set();
    this._queue    = [...this.seed];
    this._results  = [];
    this._running  = false;
    this._sinceSave = 0;
  }

  _matchesFollow(url) {
    if (!this.follow) return true;
    if (this.follow instanceof RegExp) return this.follow.test(url);
    if (typeof this.follow === 'function') return this.follow(url);
    return true;
  }

  _loadState() {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) return false;
    try {
      const raw = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      this._visited = new Set(raw.visited ?? []);
      this._queue    = raw.queue ?? [];
      this._results  = raw.results ?? [];
      return true;
    } catch {
      return false;
    }
  }

  _saveState() {
    if (!this.stateFile) return;
    const dir = path.dirname(this.stateFile);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify({
      visited: [...this._visited],
      queue:   this._queue,
      results: this._results,
    }), 'utf8');
  }

  async start(visitFn) {
    this._running = true;
    this.emit('start', { queued: this._queue.length });

    while (this._running && this._queue.length > 0 && this._visited.size < this.maxUrls) {
      const batch = [];
      while (batch.length < this.concurrency && this._queue.length > 0) {
        const url = this._queue.shift();
        if (this._visited.has(url)) continue;
        batch.push(url);
      }
      if (batch.length === 0) continue;

      const settled = await Promise.allSettled(batch.map(url => visitFn(url)));

      for (let i = 0; i < batch.length; i++) {
        const url = batch[i];
        const r   = settled[i];
        this._visited.add(url);

        if (r.status === 'fulfilled') {
          const { data, links } = r.value;
          this._results.push({ url, data });
          this.emit('url:done', { url, data });

          if (Array.isArray(links)) {
            for (const link of links) {
              if (!this._visited.has(link) && this._matchesFollow(link) && !this._queue.includes(link)) {
                this._queue.push(link);
              }
            }
          }
        } else {
          this.emit('url:error', { url, error: r.reason });
        }
      }

      this._sinceSave++;
      if (this._sinceSave >= this.saveEvery) {
        this._saveState();
        this._sinceSave = 0;
      }

      this.emit('progress', { done: this._visited.size, queued: this._queue.length, total: this.maxUrls });
    }

    this._saveState();
    this.emit('done', { total: this._results.length });

    return this._results;
  }

  pause() {
    this._running = false;
    this._saveState();
  }

  async resume(visitFn) {
    this._loadState();
    return this.start(visitFn);
  }

  results() {
    return this._results;
  }

  stats() {
    return { visited: this._visited.size, queued: this._queue.length, results: this._results.length };
  }
}

module.exports = CrawlQueue;
