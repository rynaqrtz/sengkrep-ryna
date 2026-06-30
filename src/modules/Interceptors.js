class InterceptorChain {
  constructor() {
    this._handlers = [];
  }

  use(onFulfilled, onRejected) {
    this._handlers.push({ onFulfilled, onRejected });
    return this._handlers.length - 1;
  }

  eject(id) {
    if (this._handlers[id]) this._handlers[id] = null;
  }

  async run(value) {
    let result = value;
    for (const handler of this._handlers) {
      if (!handler) continue;
      try {
        if (handler.onFulfilled) result = await handler.onFulfilled(result);
      } catch (err) {
        if (handler.onRejected) {
          result = await handler.onRejected(err);
        } else {
          throw err;
        }
      }
    }
    return result;
  }

  async runError(error) {
    let err = error;
    for (const handler of this._handlers) {
      if (!handler || !handler.onRejected) continue;
      try {
        return await handler.onRejected(err);
      } catch (nextErr) {
        err = nextErr;
      }
    }
    throw err;
  }
}

class Interceptors {
  constructor() {
    this.request  = new InterceptorChain();
    this.response = new InterceptorChain();
  }
}

module.exports = Interceptors;
