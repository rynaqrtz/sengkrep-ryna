class MemoryAdapter {
  constructor() {
    this._queue  = [];
    this._locked = new Set();
    this._done   = new Set();
  }

  async enqueue(items) {
    for (const item of items) {
      if (!this._done.has(item) && !this._queue.includes(item)) this._queue.push(item);
    }
  }

  async dequeue() {
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (this._locked.has(item) || this._done.has(item)) continue;
      this._locked.add(item);
      return item;
    }
    return null;
  }

  async complete(item) {
    this._locked.delete(item);
    this._done.add(item);
  }

  async release(item) {
    this._locked.delete(item);
    if (!this._queue.includes(item)) this._queue.push(item);
  }

  async size() {
    return { queued: this._queue.length, locked: this._locked.size, done: this._done.size };
  }
}

class DistributedQueue {
  constructor(options = {}) {
    this.adapter        = options.adapter        ?? new MemoryAdapter();
    this.workerId         = options.workerId         ?? `worker-${Math.random().toString(36).slice(2, 8)}`;
    this.pollInterval      = options.pollInterval      ?? 500;
    this.emptyRetries       = options.emptyRetries       ?? 3;
    this.maxItemRetries      = options.maxItemRetries      ?? 3;
  }

  async enqueue(items) {
    return this.adapter.enqueue(Array.isArray(items) ? items : [items]);
  }

  async run(visitFn, options = {}) {
    const concurrency = options.concurrency ?? 1;
    const results       = [];
    const failureCounts   = new Map();
    let emptyStreak         = 0;

    const worker = async () => {
      while (emptyStreak < this.emptyRetries) {
        const item = await this.adapter.dequeue();

        if (item === null) {
          emptyStreak++;
          await new Promise(r => setTimeout(r, this.pollInterval));
          continue;
        }

        emptyStreak = 0;

        try {
          const result = await visitFn(item, this.workerId);
          await this.adapter.complete(item);
          failureCounts.delete(item);
          results.push({ item, result, error: null });
        } catch (err) {
          const attempts = (failureCounts.get(item) ?? 0) + 1;
          failureCounts.set(item, attempts);

          if (attempts >= this.maxItemRetries) {
            await this.adapter.complete(item);
            results.push({ item, result: null, error: err, droppedAfterRetries: attempts });
          } else {
            await this.adapter.release(item);
            results.push({ item, result: null, error: err });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  async size() {
    return this.adapter.size();
  }
}

module.exports = { DistributedQueue, MemoryAdapter };
