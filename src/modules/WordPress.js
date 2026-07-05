class WordPress {
  constructor(ryna) {
    this.ryna = ryna;
  }

  _clean(origin) {
    return origin.replace(/\/$/, '');
  }

  async detect(origin) {
    const base = this._clean(origin);
    try {
      const res = await this.ryna._fetch(`${base}/wp-json/`);
      const body = JSON.parse(res.body);
      return {
        isWordPress: true,
        name:        body.name ?? null,
        description: body.description ?? null,
        namespaces:  body.namespaces ?? [],
      };
    } catch {
      return { isWordPress: false };
    }
  }

  async restApi(origin, endpoint, params = {}) {
    const base = this._clean(origin);
    const url  = new URL(`${base}/wp-json/${endpoint.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await this.ryna._fetch(url.href);
    const data = JSON.parse(res.body);

    return {
      data,
      total:      res.headers['x-wp-total']       ? parseInt(res.headers['x-wp-total'], 10)       : null,
      totalPages: res.headers['x-wp-totalpages']   ? parseInt(res.headers['x-wp-totalpages'], 10)   : null,
    };
  }

  async restApiAll(origin, endpoint, params = {}, options = {}) {
    const maxPages = options.maxPages ?? 20;
    const perPage  = params.per_page ?? 100;

    const results = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= maxPages) {
      const { data, totalPages: tp } = await this.restApi(origin, endpoint, { ...params, page, per_page: perPage });
      results.push(...(Array.isArray(data) ? data : [data]));
      totalPages = tp ?? 1;
      page++;
    }

    return results;
  }

  extractNonce(html, actionHint = null) {
    const patterns = [
      /(?:var\s+)?ajax_object\s*=\s*(\{[^;]+\})/,
      /(?:var\s+)?wpApiSettings\s*=\s*(\{[^;]+\})/,
      /["']nonce["']\s*:\s*["']([a-f0-9]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match) continue;
      if (match[1].startsWith('{')) {
        try {
          const obj = JSON.parse(match[1].replace(/'/g, '"'));
          if (obj.nonce) return obj.nonce;
        } catch {
          continue;
        }
      } else {
        return match[1];
      }
    }

    return null;
  }

  async ajaxAction(origin, action, data = {}, options = {}) {
    const base = this._clean(origin);
    let nonce  = options.nonce ?? null;

    if (!nonce && options.nonceFromPage) {
      const pageRes = await this.ryna._fetch(new URL(options.nonceFromPage, base).href);
      nonce = this.extractNonce(pageRes.body);
    }

    const body = new URLSearchParams({ action, ...data, ...(nonce ? { _ajax_nonce: nonce } : {}) });

    const res = await this.ryna._fetch(`${base}/wp-admin/admin-ajax.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    return JSON.parse(res.body);
  }
}

module.exports = WordPress;
