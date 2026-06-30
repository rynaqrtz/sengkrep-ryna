const cheerio = require('cheerio');

class Discover {
  constructor(fetcher) {
    this.fetcher = fetcher;
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
