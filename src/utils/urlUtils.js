function normalizeUrl(url, options = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (options.stripHash !== false) parsed.hash = '';
  if (options.stripTrailingSlash && parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  if (options.lowercaseHost !== false) parsed.hostname = parsed.hostname.toLowerCase();

  if (options.sortQuery !== false && parsed.search) {
    const params = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    parsed.search = '';
    for (const [k, v] of params) parsed.searchParams.append(k, v);
  }

  if (options.stripParams) {
    for (const param of options.stripParams) parsed.searchParams.delete(param);
  }

  if (options.stripDefaultPort !== false) {
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }
  }

  return parsed.href;
}

function extractLinks($, baseUrl, options = {}) {
  const links   = new Set();
  const pattern = options.pattern ?? null;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    let absolute;
    try {
      absolute = new URL(href, baseUrl).href;
    } catch {
      return;
    }

    if (pattern && !pattern.test(absolute)) return;
    if (options.sameOriginOnly) {
      try {
        if (new URL(absolute).hostname !== new URL(baseUrl).hostname) return;
      } catch {
        return;
      }
    }

    links.add(options.normalize === false ? absolute : normalizeUrl(absolute, options));
  });

  return [...links];
}

class UrlDeduplicator {
  constructor(options = {}) {
    this.options = options;
    this._seen   = new Set();
  }

  isDuplicate(url) {
    const normalized = normalizeUrl(url, this.options);
    return this._seen.has(normalized);
  }

  markSeen(url) {
    this._seen.add(normalizeUrl(url, this.options));
  }

  filterNew(urls) {
    const result = [];
    for (const url of urls) {
      const normalized = normalizeUrl(url, this.options);
      if (!this._seen.has(normalized)) {
        this._seen.add(normalized);
        result.push(url);
      }
    }
    return result;
  }

  size() {
    return this._seen.size;
  }

  clear() {
    this._seen.clear();
  }
}

module.exports = { normalizeUrl, extractLinks, UrlDeduplicator };
