const net   = require('net');
const tls   = require('tls');
const http  = require('http');
const https = require('https');

class ProxyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProxyError';
    this.code = 'PROXY_ERROR';
  }
}

function parseProxy(proxyUrl) {
  const u = new URL(proxyUrl);
  return {
    hostname: u.hostname,
    port:     u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80),
    auth:     u.username ? `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password || '')}` : null,
  };
}

function buildAuthHeader(proxy) {
  if (!proxy.auth) return '';
  return `Proxy-Authorization: Basic ${Buffer.from(proxy.auth).toString('base64')}\r\n`;
}

function createHttpsAgent(proxyUrl) {
  const proxy = parseProxy(proxyUrl);

  return new https.Agent({
    keepAlive: false,
    createConnection(options, callback) {
      const targetHost = options.hostname || options.host;
      const targetPort = options.port || 443;

      const socket = net.connect(proxy.port, proxy.hostname, () => {
        let req = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n`;
        req += `Host: ${targetHost}:${targetPort}\r\n`;
        req += buildAuthHeader(proxy);
        req += 'Connection: keep-alive\r\n\r\n';
        socket.write(req);
      });

      let buffer = '';

      function onData(chunk) {
        buffer += chunk.toString('latin1');
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        socket.removeListener('data', onData);
        socket.removeListener('error', onError);

        const statusLine = buffer.slice(0, buffer.indexOf('\r\n'));
        const match       = /^HTTP\/\d\.\d (\d{3})/.exec(statusLine);

        if (!match || match[1] !== '200') {
          socket.destroy();
          return callback(new ProxyError(`CONNECT tunnel failed: ${statusLine || 'no response'}`));
        }

        const leftover  = buffer.slice(headerEnd + 4);
        const tlsSocket = tls.connect({
          socket,
          servername:        options.servername || targetHost,
          rejectUnauthorized: options.rejectUnauthorized !== false,
        });

        tlsSocket.once('secureConnect', () => callback(null, tlsSocket));
        tlsSocket.once('error', err => callback(new ProxyError(`TLS over tunnel failed: ${err.message}`)));

        if (leftover) tlsSocket.unshift(Buffer.from(leftover, 'latin1'));
      }

      function onError(err) {
        callback(new ProxyError(`Proxy connection failed: ${err.message}`));
      }

      socket.on('data', onData);
      socket.once('error', onError);
    },
  });
}

function routeHttpThroughProxy(reqOptions, targetUrl, proxyUrl) {
  const proxy = parseProxy(proxyUrl);
  const auth  = proxy.auth ? { 'Proxy-Authorization': `Basic ${Buffer.from(proxy.auth).toString('base64')}` } : {};

  return {
    ...reqOptions,
    hostname: proxy.hostname,
    port:     proxy.port,
    path:     targetUrl,
    headers:  { ...reqOptions.headers, ...auth },
  };
}

module.exports = { createHttpsAgent, routeHttpThroughProxy, parseProxy, ProxyError };
