class ProgressBar {
  constructor(options = {}) {
    this.total     = options.total   ?? 100;
    this.width     = options.width   ?? 30;
    this.label     = options.label   ?? '';
    this.stream    = options.stream  ?? process.stdout;
    this.enabled   = options.enabled ?? (this.stream.isTTY === true);
    this._current   = 0;
    this._startedAt = Date.now();
  }

  update(current, extra = '') {
    this._current = current;
    if (!this.enabled) return;

    const ratio    = this.total > 0 ? Math.min(1, current / this.total) : 0;
    const filled   = Math.round(this.width * ratio);
    const bar      = '█'.repeat(filled) + '░'.repeat(this.width - filled);
    const percent  = Math.round(ratio * 100);
    const elapsed  = (Date.now() - this._startedAt) / 1000;
    const rate     = elapsed > 0 ? (current / elapsed).toFixed(1) : '0.0';

    const line = `\r${this.label ? this.label + ' ' : ''}[${bar}] ${percent}% (${current}/${this.total}) ${rate}/s${extra ? ' ' + extra : ''}`;
    this.stream.write(line);
  }

  increment(step = 1, extra = '') {
    this.update(this._current + step, extra);
  }

  finish(message = '') {
    this.update(this.total, message);
    if (this.enabled) this.stream.write('\n');
  }
}

module.exports = ProgressBar;
