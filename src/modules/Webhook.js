const https = require('https');
const http  = require('http');

function post(url, payload) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve(false);
    }

    const lib  = parsed.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);

    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     `${parsed.pathname}${parsed.search}`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 8000,
    }, (res) => {
      res.resume();
      resolve(res.statusCode < 400);
    });

    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error',   () => resolve(false));

    req.write(body);
    req.end();
  });
}

class Webhook {
  constructor(config = {}) {
    this.config = config;
  }

  async fire(event, payload = {}) {
    const url = this.config[event];
    if (!url) return;
    const data = { event, timestamp: new Date().toISOString(), ...payload };
    post(url, data);
  }
}

module.exports = Webhook;
