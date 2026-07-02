const fs   = require('fs');
const path = require('path');

function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

class StreamWriter {
  constructor(filePath, options = {}) {
    this.filePath   = filePath;
    this.format      = options.format ?? (filePath.endsWith('.csv') ? 'csv' : 'jsonl');
    this._headerDone = false;
    this._keys       = options.keys ?? null;

    const dir = path.dirname(filePath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this._stream = fs.createWriteStream(filePath, { flags: 'w' });
    this._count  = 0;
  }

  write(row) {
    if (this.format === 'jsonl') {
      this._stream.write(`${JSON.stringify(row)}\n`);
      this._count++;
      return;
    }

    if (!this._headerDone) {
      this._keys = this._keys ?? Object.keys(row);
      this._stream.write(`${this._keys.map(escapeCsvField).join(',')}\n`);
      this._headerDone = true;
    }

    this._stream.write(`${this._keys.map(k => escapeCsvField(row[k])).join(',')}\n`);
    this._count++;
  }

  writeMany(rows) {
    for (const row of rows) this.write(row);
  }

  count() {
    return this._count;
  }

  async close() {
    return new Promise((resolve) => {
      this._stream.end(resolve);
    });
  }
}

module.exports = StreamWriter;
