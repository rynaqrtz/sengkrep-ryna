class CookieJar {
  constructor() {
    this._store = new Map();
  }

  _baseDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  }

  _parseSetCookie(line) {
    const segments = line.split(';').map(s => s.trim());
    const [nameValue, ...attrs] = segments;
    const eq    = nameValue.indexOf('=');
    if (eq === -1) return null;

    const name  = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();

    const cookie = { name, value, domain: null, path: '/', expires: null, secure: false, httpOnly: false };

    for (const attr of attrs) {
      const [k, v] = attr.split('=').map(s => s?.trim());
      const key    = k.toLowerCase();
      if (key === 'domain')  cookie.domain  = v?.replace(/^\./, '') ?? null;
      if (key === 'path')    cookie.path    = v ?? '/';
      if (key === 'expires') cookie.expires = Date.parse(v) || null;
      if (key === 'max-age') cookie.expires = Date.now() + (parseInt(v, 10) * 1000);
      if (key === 'secure')   cookie.secure   = true;
      if (key === 'httponly') cookie.httpOnly = true;
    }

    return cookie;
  }

  setFromHeaders(hostname, setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const domain  = this._baseDomain(hostname);

    if (!this._store.has(domain)) this._store.set(domain, new Map());
    const bucket = this._store.get(domain);

    for (const line of headers) {
      const cookie = this._parseSetCookie(line);
      if (!cookie) continue;
      bucket.set(cookie.name, cookie);
    }
  }

  setManual(hostname, name, value, options = {}) {
    const domain = this._baseDomain(hostname);
    if (!this._store.has(domain)) this._store.set(domain, new Map());
    this._store.get(domain).set(name, { name, value, path: '/', expires: null, secure: false, httpOnly: false, ...options });
  }

  getCookieHeader(hostname) {
    const domain = this._baseDomain(hostname);
    const bucket = this._store.get(domain);
    if (!bucket || bucket.size === 0) return null;

    const now    = Date.now();
    const active = [];

    for (const [name, cookie] of bucket.entries()) {
      if (cookie.expires && cookie.expires < now) {
        bucket.delete(name);
        continue;
      }
      active.push(`${cookie.name}=${cookie.value}`);
    }

    return active.length > 0 ? active.join('; ') : null;
  }

  getAll(hostname) {
    const domain = this._baseDomain(hostname);
    const bucket = this._store.get(domain);
    if (!bucket) return [];
    return [...bucket.values()];
  }

  clear(hostname) {
    if (hostname) {
      this._store.delete(this._baseDomain(hostname));
    } else {
      this._store.clear();
    }
  }

  export() {
    const out = {};
    for (const [domain, bucket] of this._store.entries()) {
      out[domain] = [...bucket.values()];
    }
    return out;
  }

  import(snapshot) {
    for (const [domain, cookies] of Object.entries(snapshot)) {
      const bucket = new Map();
      for (const cookie of cookies) bucket.set(cookie.name, cookie);
      this._store.set(domain, bucket);
    }
  }
}

module.exports = CookieJar;
