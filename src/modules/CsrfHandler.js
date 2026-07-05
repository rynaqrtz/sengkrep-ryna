class CsrfHandler {
  constructor(options = {}) {
    this.enabled       = options.auto        ?? true;
    this.headerName    = options.headerName  ?? 'X-CSRF-Token';
    this.fieldName     = options.fieldName   ?? '_token';
    this.cookieNames   = options.cookieNames ?? ['XSRF-TOKEN', 'csrftoken', 'csrf_token'];
    this.metaSelectors = options.metaSelectors ?? ['meta[name="csrf-token"]', 'meta[name="csrf-param"]'];
    this.inputSelectors = options.inputSelectors ?? [
      'input[name="_token"]',
      'input[name="csrf_token"]',
      'input[name="authenticity_token"]',
      'input[name="__RequestVerificationToken"]',
    ];
  }

  extractFromHtml($) {
    for (const sel of this.metaSelectors) {
      const val = $(sel).attr('content');
      if (val) return val;
    }
    for (const sel of this.inputSelectors) {
      const val = $(sel).attr('value');
      if (val) return val;
    }
    return null;
  }

  extractFromCookies(cookieJar, hostname) {
    if (!cookieJar) return null;
    const all = cookieJar.getAll(hostname);
    for (const name of this.cookieNames) {
      const found = all.find(c => c.name === name);
      if (found) return found.value;
    }
    return null;
  }

  buildFormBody(fields, token) {
    const params = new URLSearchParams(fields);
    if (token) params.set(this.fieldName, token);
    return params.toString();
  }

  buildHeaders(token, extra = {}) {
    if (!token) return extra;
    return { ...extra, [this.headerName]: token };
  }
}

module.exports = CsrfHandler;
