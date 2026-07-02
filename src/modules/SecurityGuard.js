const dns = require('dns');
const net = require('net');

class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
    this.code = 'SECURITY_BLOCKED';
  }
}

const PRIVATE_V4_RANGES = [
  [/^127\./, 'loopback'],
  [/^10\./, 'private-a'],
  [/^172\.(1[6-9]|2\d|3[0-1])\./, 'private-b'],
  [/^192\.168\./, 'private-c'],
  [/^169\.254\./, 'link-local'],
  [/^0\./, 'unspecified'],
  [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, 'carrier-grade-nat'],
];

function isPrivateIPv4(ip) {
  for (const [pattern, label] of PRIVATE_V4_RANGES) {
    if (pattern.test(ip)) return label;
  }
  return null;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return 'loopback';
  if (lower.startsWith('fe80:')) return 'link-local';
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return 'unique-local';
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7);
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }
  return null;
}

function classifyIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return null;
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

class SecurityGuard {
  constructor(options = {}) {
    this.blockPrivateIPs = options.blockPrivateIPs ?? false;
    this.allowDomains     = (options.allowDomains ?? null)?.map(globToRegExp) ?? null;
    this.blockDomains     = (options.blockDomains ?? []).map(globToRegExp);
    this.blockedPorts     = new Set(options.blockedPorts ?? [22, 23, 25, 3306, 5432, 6379, 27017]);
  }

  get enabled() {
    return this.blockPrivateIPs || this.allowDomains !== null || this.blockDomains.length > 0;
  }

  checkDomain(hostname) {
    if (this.allowDomains && !this.allowDomains.some(re => re.test(hostname))) {
      throw new SecurityError(`Domain not in allowlist: ${hostname}`);
    }
    if (this.blockDomains.some(re => re.test(hostname))) {
      throw new SecurityError(`Domain is blocked: ${hostname}`);
    }
  }

  checkPort(port) {
    if (this.blockedPorts.has(Number(port))) {
      throw new SecurityError(`Port is blocked: ${port}`);
    }
  }

  async checkAddress(hostname) {
    if (!this.blockPrivateIPs) return;

    let ip = hostname;
    if (!net.isIP(hostname)) {
      ip = await new Promise((resolve, reject) => {
        dns.lookup(hostname, (err, address) => (err ? reject(err) : resolve(address)));
      });
    }

    const label = classifyIP(ip);
    if (label) {
      throw new SecurityError(`Blocked private/internal address (${label}): ${hostname} -> ${ip}`);
    }
  }

  async check(url) {
    if (!this.enabled) return true;

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new SecurityError(`Invalid URL: ${url}`);
    }

    this.checkDomain(parsed.hostname);
    if (parsed.port) this.checkPort(parsed.port);
    await this.checkAddress(parsed.hostname);

    return true;
  }
}

module.exports = { SecurityGuard, SecurityError, classifyIP, globToRegExp };
