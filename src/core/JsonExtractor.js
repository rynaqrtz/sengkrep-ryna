class JsonExtractionError extends Error {
  constructor(message, field, path) {
    super(message);
    this.name  = 'JsonExtractionError';
    this.field = field;
    this.path  = path;
  }
}

function tokenize(path) {
  return path.split('.').filter(Boolean).map((segment) => {
    const match = segment.match(/^([^\[]*)((?:\[\d*\])*)$/);
    if (!match) return { key: segment, indices: [] };

    const key      = match[1] || null;
    const idxPart  = match[2] || '';
    const indices  = [...idxPart.matchAll(/\[(\d*)\]/g)].map(m => (m[1] === '' ? null : parseInt(m[1], 10)));

    return { key, indices };
  });
}

function hasWildcard(tokens) {
  return tokens.some(t => t.indices.includes(null));
}

function resolvePath(root, tokens) {
  let current = [root];

  for (const token of tokens) {
    const next = [];

    for (const item of current) {
      if (item === null || item === undefined) continue;

      let value = token.key ? item[token.key] : item;

      if (token.indices.length === 0) {
        next.push(value);
        continue;
      }

      let values = [value];
      for (const idx of token.indices) {
        const stepped = [];
        for (const v of values) {
          if (!Array.isArray(v)) continue;
          if (idx === null) {
            stepped.push(...v);
          } else {
            stepped.push(v[idx]);
          }
        }
        values = stepped;
      }
      next.push(...values);
    }

    current = next;
  }

  return current;
}

class JsonExtractor {
  _resolveSchema(schema) {
    const out = {};
    for (const [key, val] of Object.entries(schema)) {
      if (typeof val === 'string') {
        out[key] = { path: val, required: false, transform: null, default: null, pattern: null };
        continue;
      }
      out[key] = {
        path:      val.path,
        required:  val.required  ?? false,
        transform: val.transform ?? null,
        default:   val.default   ?? null,
        pattern:   val.pattern   ?? null,
      };
    }
    return out;
  }

  extract(jsonBody, schema) {
    let root;
    try {
      root = typeof jsonBody === 'string' ? JSON.parse(jsonBody) : jsonBody;
    } catch (err) {
      throw new JsonExtractionError(`Invalid JSON body: ${err.message}`, null, null);
    }

    const defs   = this._resolveSchema(schema);
    const data   = {};
    const health = {};

    for (const [key, def] of Object.entries(defs)) {
      const paths = Array.isArray(def.path) ? def.path : [def.path];

      let value        = null;
      let usedPath      = null;
      let wildcardUsed   = false;

      for (const path of paths) {
        const tokens   = tokenize(path);
        const wildcard = hasWildcard(tokens);
        const resolved = resolvePath(root, tokens);

        let candidate = wildcard ? resolved.filter(v => v !== undefined) : resolved[0];
        if (candidate === undefined) candidate = null;

        const candidateEmpty = candidate === null || (Array.isArray(candidate) && candidate.length === 0);
        if (!candidateEmpty) {
          value       = candidate;
          usedPath    = path;
          wildcardUsed = wildcard;
          break;
        }
      }

      if (value !== null && def.transform) {
        value = wildcardUsed ? value.map(def.transform) : def.transform(value);
      }

      const isEmpty = value === null || value === undefined || (Array.isArray(value) && value.length === 0);

      health[key] = {
        selector:      usedPath ?? paths[0],
        pathsTried:    paths.length > 1 ? paths : undefined,
        empty:         isEmpty,
        count:         Array.isArray(value) ? value.length : (isEmpty ? 0 : 1),
      };

      if (isEmpty) {
        if (def.required) {
          const attempted = paths.length > 1 ? paths.map(p => `"${p}"`).join(', ') : `"${paths[0]}"`;
          throw new JsonExtractionError(`Required field "${key}" not found (tried path${paths.length > 1 ? 's' : ''}: ${attempted})`, key, paths[0]);
        }
        data[key] = def.default;
        continue;
      }

      if (def.pattern) {
        const toTest = Array.isArray(value) ? value[0] : value;
        if (!def.pattern.test(String(toTest))) {
          health[key].patternMismatch = true;
        }
      }

      data[key] = value;
    }

    return { data, health };
  }
}

module.exports = { JsonExtractor, JsonExtractionError, tokenize, resolvePath };
