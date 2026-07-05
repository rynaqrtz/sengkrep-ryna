const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

class Logger {
  constructor(level = 'info', pretty = true) {
    this.level = LEVELS[level] ?? 2;
    this.pretty = pretty;
  }

  _log(level, ...args) {
    if (LEVELS[level] > this.level) return;
    const ts = new Date().toISOString();
    const tag = `[${ts}] [RYNA:${level.toUpperCase()}]`;
    if (this.pretty) {
      process.stdout.write(`${COLORS[level]}${tag}${COLORS.reset} `);
      console.log(...args);
    } else {
      console.log(tag, ...args);
    }
  }

  error(...args) { this._log('error', ...args); }
  warn(...args)  { this._log('warn', ...args); }
  info(...args)  { this._log('info', ...args); }
  debug(...args) { this._log('debug', ...args); }
}

module.exports = Logger;
