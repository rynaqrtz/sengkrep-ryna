const cheerio = require('cheerio');

class ExtractionError extends Error {
  constructor(message, field, selector) {
    super(message);
    this.name     = 'ExtractionError';
    this.field    = field;
    this.selector = selector;
  }
}

class Extractor {
  _resolve(schema) {
    const out = {};
    for (const [key, val] of Object.entries(schema)) {
      if (typeof val === 'string') {
        out[key] = {
          selector: val,
          required: false,
          multiple: false,
          attr:      null,
          type:     'text',
          transform: null,
          default:   null,
          pattern:   null,
        };
        continue;
      }
      if (Array.isArray(val)) {
        out[key] = {
          selector: val[0],
          required: false,
          multiple: true,
          attr:      null,
          type:     'text',
          transform: null,
          default:  [],
          pattern:   null,
        };
        continue;
      }
      out[key] = {
        selector:  val.selector,
        required:  val.required  ?? false,
        multiple:  val.multiple  ?? false,
        attr:      val.attr      ?? null,
        type:      val.type      ?? 'text',
        transform: val.transform ?? null,
        default:   val.default   ?? null,
        pattern:   val.pattern   ?? null,
      };
    }
    return out;
  }

  _pull($, el, def) {
    const { attr, type, transform } = def;
    let val;
    if (attr) {
      val = $(el).attr(attr) ?? null;
    } else if (type === 'html') {
      val = $(el).html()?.trim() ?? null;
    } else {
      val = $(el).text()?.trim() ?? null;
    }
    if (val && transform) val = transform(val);
    return val;
  }

  _extract($, def) {
    const els = $(def.selector);
    if (els.length === 0) return def.multiple ? [] : null;
    if (def.multiple) {
      return els.map((_, el) => this._pull($, el, def)).get();
    }
    return this._pull($, els.first().get(0), def);
  }

  load(html) {
    return cheerio.load(html);
  }

  extract(html, schema) {
    const $      = cheerio.load(html);
    const defs   = this._resolve(schema);
    const data   = {};
    const health = {};

    for (const [key, def] of Object.entries(defs)) {
      const value   = this._extract($, def);
      const isEmpty = value === null || value === '' || (Array.isArray(value) && value.length === 0);

      health[key] = {
        selector: def.selector,
        empty:    isEmpty,
        count:    Array.isArray(value) ? value.length : (isEmpty ? 0 : 1),
      };

      if (isEmpty) {
        if (def.required) {
          throw new ExtractionError(
            `Required field "${key}" returned empty (selector: "${def.selector}")`,
            key,
            def.selector,
          );
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

module.exports = { Extractor, ExtractionError };
