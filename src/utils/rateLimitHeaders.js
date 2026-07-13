function parseRateLimitHeaders(headers) {
  const get = (...names) => {
    for (const name of names) {
      if (headers[name] !== undefined) return headers[name];
    }
    return null;
  };

  const limit     = get('ratelimit-limit', 'x-ratelimit-limit');
  const remaining = get('ratelimit-remaining', 'x-ratelimit-remaining');
  const reset     = get('ratelimit-reset', 'x-ratelimit-reset');

  if (limit === null && remaining === null && reset === null) return null;

  return {
    limit:     limit     !== null ? parseInt(limit, 10)     : null,
    remaining: remaining !== null ? parseInt(remaining, 10) : null,
    resetSeconds: reset  !== null ? parseInt(reset, 10)     : null,
  };
}

module.exports = { parseRateLimitHeaders };
