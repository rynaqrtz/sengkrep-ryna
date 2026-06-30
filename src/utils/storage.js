const fs   = require('fs');
const path = require('path');

class Storage {
  constructor(dir = '.sengkrep-ryna') {
    this.dir = dir;
    this._boot();
  }

  _boot() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  _toPath(key) {
    const safe = Buffer.from(key).toString('base64').replace(/[/+=]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  set(key, value) {
    const payload = JSON.stringify({ ts: Date.now(), data: value }, null, 2);
    fs.writeFileSync(this._toPath(key), payload, 'utf8');
    return true;
  }

  get(key) {
    const p = this._toPath(key);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  }

  delete(key) {
    const p = this._toPath(key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  list() {
    return fs.readdirSync(this.dir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  }

  clear() {
    for (const file of this.list()) {
      fs.unlinkSync(path.join(this.dir, `${file}.json`));
    }
  }
}

module.exports = Storage;
