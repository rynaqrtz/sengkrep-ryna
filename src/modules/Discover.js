const cheerio = require('cheerio');

function patternToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\\\$$/, '$');
  return new RegExp(`^${escaped}`);
}

function parseRobotsRules(text) {
  const lines  = text.split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean);
  const groups = [];
  let current  = null;

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z-]+)\s*:\s*(.*)$/);
    if (!match) continue;

    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [value.toLowerCase()], rules: [], crawlDelay: null };
        groups.push(current);
      } else {
        current.agents.push(value.toLowerCase());
      }
      continue;
    }

    if (!current) continue;

    if (field === 'disallow' && value) {
      current.rules.push({ type: 'disallow', pattern: value, regex: patternToRegExp(value) });
    } else if (field === 'allow' && value) {
      current.rules.push({ type: 'allow', pattern: value, regex: patternToRegExp(value) });
    } else if (field === 'crawl-delay') {
      const n = parseFloat(value);
      if (!isNaN(n)) current.crawlDelay = n * 1000;
    }
  }

  return groups;
}

function selectGroup(groups, userAgent) {
  const ua = userAgent.toLowerCase();
  const specific = groups.find(g => g.agents.some(a => a !== '*' && ua.includes(a)));
  if (specific) return specific;
  return groups.find(g => g.agents.includes('*')) ?? null;
}

class Discover {
  constructor(fetcher) {
    this.fetcher     = fetcher;
    this._robotsCache = new Map();
  }

  async _fetchText(url) {
    try {
      const res = await this.fetcher.fetch(url);
      return res.body;
    } catch {
      return null;
    }
  }

  _parseRobotsSitemaps(text) {
    const lines = text.split('\n');
    const found = [];
    for (const line of lines) {
      const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
      if (match) found.push(match[1].trim());
    }
    return found;
  }

  _parseSitemapXml(xml) {
    const $       = cheerio.load(xml, { xmlMode: true });
    const isIndex = $('sitemapindex').length > 0;
    const locs    = $('loc').map((_, el) => $(el).text().trim()).get();
    return { isIndex, locs };
  }

  async _getRobots(origin) {
    if (this._robotsCache.has(origin)) return this._robotsCache.get(origin);

    const robotsUrl = `${origin.replace(/\/$/, '')}/robots.txt`;
    const text       = await this._fetchText(robotsUrl);
    const groups      = text ? parseRobotsRules(text) : [];

    this._robotsCache.set(origin, groups);
    return groups;
  }

  async isAllowed(url, userAgent = '*') {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return true;
    }

    const origin = `${parsed.protocol}//${parsed.host}`;
    const groups  = await this._getRobots(origin);
    if (groups.length === 0) return true;

    const group = selectGroup(groups, userAgent);
    if (!group) return true;

    const target  = `${parsed.pathname}${parsed.search}`;
    const matches = group.rules.filter(r => r.regex.test(target));
    if (matches.length === 0) return true;

    matches.sort((a, b) => b.pattern.length - a.pattern.length);
    const longest = matches[0];
    const tiedLongest = matches.filter(m => m.pattern.length === longest.pattern.length);
    const hasAllowTie  = tiedLongest.some(m => m.type === 'allow');

    return hasAllowTie || longest.type === 'allow';
  }

  async getCrawlDelay(origin, userAgent = '*') {
    const groups = await this._getRobots(origin);
    const group   = selectGroup(groups, userAgent);
    return group?.crawlDelay ?? null;
  }

  async fromRobots(origin) {
    const robotsUrl = `${origin.replace(/\/$/, '')}/robots.txt`;
    const text       = await this._fetchText(robotsUrl);
    if (!text) return [];
    return this._parseRobotsSitemaps(text);
  }

  async fromSitemap(sitemapUrl, options = {}) {
    const maxDepth   = options.maxDepth   ?? 1;
    const maxEntries = options.maxEntries ?? 5000;
    const pattern    = options.pattern    ?? null;

    const visited = new Set();
    const results = [];

    const walk = async (url, depth) => {
      if (visited.has(url) || depth > maxDepth || results.length >= maxEntries) return;
      visited.add(url);

      const xml = await this._fetchText(url);
      if (!xml) return;

      const { isIndex, locs } = this._parseSitemapXml(xml);

      if (isIndex) {
        for (const loc of locs) {
          if (results.length >= maxEntries) break;
          await walk(loc, depth + 1);
        }
      } else {
        for (const loc of locs) {
          if (results.length >= maxEntries) break;
          if (pattern && !pattern.test(loc)) continue;
          results.push(loc);
        }
      }
    };

    await walk(sitemapUrl, 0);
    return results;
  }

  async run(origin, options = {}) {
    const clean = origin.replace(/\/$/, '');

    let sitemapUrls = await this.fromRobots(clean);
    if (sitemapUrls.length === 0) {
      sitemapUrls = [`${clean}/sitemap.xml`];
    }

    const all = [];
    for (const sm of sitemapUrls) {
      const urls = await this.fromSitemap(sm, options);
      all.push(...urls);
    }

    return [...new Set(all)];
  }
}

module.exports = Discover;
