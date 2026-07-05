class AuthManager {
  constructor(options = {}) {
    this.type       = options.type       ?? 'bearer';
    this.token      = options.token      ?? null;
    this.refreshOn  = options.refreshOn  ?? [401];
    this.refreshFn  = options.refresh    ?? null;
    this.onRefresh  = options.onRefresh  ?? null;
    this.headerName = options.headerName ?? 'Authorization';
    this._refreshing = null;
  }

  get enabled() {
    return this.token !== null || this.refreshFn !== null;
  }

  buildHeaders(extra = {}) {
    if (!this.token) return extra;
    const prefix = this.type === 'bearer' ? 'Bearer ' : '';
    return { ...extra, [this.headerName]: `${prefix}${this.token}` };
  }

  shouldRefresh(status) {
    return this.refreshFn !== null && this.refreshOn.includes(status);
  }

  async refresh() {
    if (!this.refreshFn) return this.token;

    if (!this._refreshing) {
      this._refreshing = Promise.resolve(this.refreshFn(this.token))
        .then((newToken) => {
          this.token       = newToken;
          this._refreshing = null;
          if (this.onRefresh) this.onRefresh(newToken);
          return newToken;
        })
        .catch((err) => {
          this._refreshing = null;
          throw err;
        });
    }

    return this._refreshing;
  }
}

module.exports = AuthManager;
