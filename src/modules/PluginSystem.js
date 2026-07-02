class PluginSystem {
  constructor() {
    this._hooks = { beforeRequest: [], afterExtract: [], onError: [] };
  }

  use(plugin) {
    if (typeof plugin === 'function') {
      plugin(this);
      return this;
    }
    for (const hook of Object.keys(this._hooks)) {
      if (typeof plugin[hook] === 'function') this._hooks[hook].push(plugin[hook]);
    }
    return this;
  }

  hook(name, fn) {
    if (!this._hooks[name]) this._hooks[name] = [];
    this._hooks[name].push(fn);
    return this;
  }

  async run(hookName, payload) {
    let result = payload;
    for (const fn of this._hooks[hookName] ?? []) {
      const next = await fn(result);
      if (next !== undefined) result = next;
    }
    return result;
  }
}

module.exports = PluginSystem;
