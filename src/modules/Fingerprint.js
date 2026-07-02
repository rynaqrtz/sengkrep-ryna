const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.9',
  'en-US,en;q=0.8',
  'en-US,en;q=0.9,id;q=0.8',
  'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'en-US,en;q=0.5',
];

const ACCEPT_ENCODINGS = [
  'gzip, deflate, br',
  'gzip, deflate, br, zstd',
  'gzip, deflate',
];

const PLATFORMS = ['"Windows"', '"macOS"', '"Linux"'];

class Fingerprint {
  constructor(options = {}) {
    this.options = {
      userAgent:              options.userAgent ?? 'random',
      rotateUAOnEachRequest:  options.rotateUAOnEachRequest ?? true,
      randomizeHeaderOrder:   options.randomizeHeaderOrder ?? true,
      randomizeTiming:        options.randomizeTiming ?? true,
      ...options,
    };
    this._uaIndex = 0;
  }

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _jitter(base, factor = 0.3) {
    const delta = base * factor;
    return base - delta + Math.random() * delta * 2;
  }

  getUA() {
    if (this.options.userAgent && this.options.userAgent !== 'random') {
      return this.options.userAgent;
    }
    if (this.options.rotateUAOnEachRequest) {
      return this._pick(USER_AGENTS);
    }
    const ua = USER_AGENTS[this._uaIndex % USER_AGENTS.length];
    this._uaIndex++;
    return ua;
  }

  _detect(ua) {
    return {
      isChrome:  ua.includes('Chrome') && !ua.includes('Edg'),
      isFirefox: ua.includes('Firefox'),
      isSafari:  ua.includes('Safari') && !ua.includes('Chrome'),
      isEdge:    ua.includes('Edg'),
    };
  }

  _secFetchSite(context) {
    if (!context || !context.referer) return 'none';
    try {
      const refUrl    = new URL(context.referer);
      const targetUrl = new URL(context.targetUrl);
      if (refUrl.origin === targetUrl.origin) return 'same-origin';

      const refSite    = refUrl.hostname.split('.').slice(-2).join('.');
      const targetSite = targetUrl.hostname.split('.').slice(-2).join('.');
      return refSite === targetSite ? 'same-site' : 'cross-site';
    } catch {
      return 'none';
    }
  }

  buildHeaders(extra = {}, context = null) {
    const ua      = this.getUA();
    const browser = this._detect(ua);
    const lang    = this._pick(ACCEPT_LANGUAGES);
    const enc     = this._pick(ACCEPT_ENCODINGS);
    const site    = this._secFetchSite(context);

    const base = {
      'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language':           lang,
      'Accept-Encoding':           enc,
      'User-Agent':                ua,
      'Connection':                'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    if (context?.referer) base['Referer'] = context.referer;

    if (Math.random() > 0.5) {
      base['Cache-Control'] = this._pick(['no-cache', 'max-age=0']);
    }

    if (browser.isChrome || browser.isEdge) {
      const brand = browser.isEdge
        ? '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"'
        : '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';

      base['Sec-CH-UA']          = brand;
      base['Sec-CH-UA-Mobile']   = '?0';
      base['Sec-CH-UA-Platform'] = this._pick(PLATFORMS);
      base['Sec-Fetch-Dest']     = 'document';
      base['Sec-Fetch-Mode']     = site === 'none' ? 'navigate' : 'cors';
      base['Sec-Fetch-Site']     = site;
      base['Sec-Fetch-User']     = '?1';
      if (Math.random() > 0.6) base['DNT'] = '1';
    }

    if (browser.isFirefox) {
      base['Sec-Fetch-Dest'] = 'document';
      base['Sec-Fetch-Mode'] = site === 'none' ? 'navigate' : 'cors';
      base['Sec-Fetch-Site'] = site;
      base['Sec-Fetch-User'] = '?1';
      base['TE']             = 'trailers';
    }

    const merged = { ...base, ...extra };

    if (this.options.randomizeHeaderOrder) {
      const entries = Object.entries(merged);
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
      return Object.fromEntries(entries);
    }

    return merged;
  }

  async delay(base = 1000) {
    if (!this.options.randomizeTiming) {
      return new Promise(r => setTimeout(r, base));
    }
    const ms = Math.round(Math.abs(this._jitter(base)));
    return new Promise(r => setTimeout(r, ms));
  }

  async humanDelay(min = 600, max = 2500) {
    const ms = Math.round(min + Math.random() * (max - min));
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = Fingerprint;
