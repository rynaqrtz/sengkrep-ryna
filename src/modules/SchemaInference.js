const PRICE_PATTERN  = /^[\s]*[£$€Rp]\s?[\d.,]+[\s]*$/;
const DATE_PATTERN    = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$|^[A-Z][a-z]{2,8}\s\d{1,2},?\s\d{4}$/;
const NUMBER_PATTERN    = /^-?\d+([.,]\d+)?$/;

const FIELD_NAME_HINTS = {
  title:       [/title/i, /^h1$/i, /^h2$/i, /name/i, /heading/i],
  price:       [/price/i, /cost/i, /amount/i, /harga/i],
  image:       [/image/i, /photo/i, /thumbnail/i, /avatar/i, /^img$/i],
  link:        [/link/i, /url/i, /href/i],
  date:        [/date/i, /time/i, /published/i, /created/i, /tanggal/i],
  description: [/desc/i, /summary/i, /excerpt/i, /content/i, /body/i],
  rating:      [/rating/i, /star/i, /score/i],
  author:      [/author/i, /by-?line/i, /writer/i, /penulis/i],
  category:    [/categor/i, /genre/i, /tag/i, /kategori/i],
};

function tagNameOf($, el) {
  return ($(el).prop('tagName') ?? '').toLowerCase();
}

function classNameScore(className, hints) {
  if (!className) return 0;
  for (const pattern of hints) {
    if (pattern.test(className)) return 1;
  }
  return 0;
}

function valueTypeScore(text, fieldName) {
  if (fieldName === 'price' && PRICE_PATTERN.test(text)) return 1;
  if (fieldName === 'date' && DATE_PATTERN.test(text)) return 1;
  if (fieldName === 'rating' && NUMBER_PATTERN.test(text) && parseFloat(text) <= 5) return 0.6;
  return 0;
}

function walkElements($, node, depth, out) {
  if (depth > 40) return;
  $(node).children().each((_, child) => {
    out.push(child);
    walkElements($, child, depth + 1, out);
  });
}

function collectCandidates($, root) {
  const elements = [];
  walkElements($, root, 0, elements);

  const candidates = [];

  for (const el of elements) {
    const tag  = tagNameOf($, el);
    if (!tag || tag === 'script' || tag === 'style') continue;

    const wrapped   = $(el);
    const className  = wrapped.attr('class') ?? '';
    const id          = wrapped.attr('id') ?? '';
    const text        = wrapped.text().trim();
    const src          = wrapped.attr('src');
    const href          = wrapped.attr('href');

    if (!text && !src && !href) continue;
    if (text.length > 400) continue;

    candidates.push({ el, tag, className, id, text, src, href });
  }

  return candidates;
}

function buildSelector(candidate) {
  const { tag, className, id } = candidate;
  if (id) return `#${id}`;
  if (className) {
    const firstClass = className.split(/\s+/)[0];
    return `${tag}.${firstClass}`;
  }
  return tag;
}

function scoreField(candidate, fieldName) {
  const hints = FIELD_NAME_HINTS[fieldName] ?? [];
  let score = 0;

  score += classNameScore(candidate.className, hints) * 0.5;
  score += classNameScore(candidate.id, hints) * 0.3;
  score += valueTypeScore(candidate.text, fieldName) * 0.4;

  if (fieldName === 'title' && /^h[1-3]$/.test(candidate.tag)) score += 0.3;
  if (fieldName === 'image' && candidate.tag === 'img') score += 0.5;
  if (fieldName === 'link' && candidate.tag === 'a') score += 0.3;

  return Math.min(1, score);
}

function inferFields($, root, targetFields) {
  const candidates = collectCandidates($, root);
  const fields      = targetFields ?? Object.keys(FIELD_NAME_HINTS);
  const suggestions = {};

  for (const fieldName of fields) {
    let best      = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = scoreField(candidate, fieldName);
      if (score > bestScore) {
        bestScore = score;
        best      = candidate;
      }
    }

    if (best && bestScore >= 0.3) {
      const selector = buildSelector(best);
      const field     = { selector, confidence: Math.round(bestScore * 100) / 100 };

      if (best.tag === 'img' && best.src) field.attr = 'src';
      if (best.tag === 'a' && best.href) field.attr = 'href';

      suggestions[fieldName] = field;
    }
  }

  return suggestions;
}

function detectRepeatingContainers($, root) {
  const elements = [];
  walkElements($, root, 0, elements);

  const groups = new Map();

  for (const el of elements) {
    const tag       = tagNameOf($, el);
    const className  = $(el).attr('class');
    if (!className) continue;

    const key = `${tag}.${className.split(/\s+/)[0]}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [...groups.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([selector, count]) => ({ selector, count }));
}

function inferSchema($, options = {}) {
  const hints     = options.hints ?? null;
  const root       = options.root ?? $.root ?? 'body';
  const repeating = detectRepeatingContainers($, root);

  if (repeating.length > 0 && options.list !== false) {
    const containerSelector = repeating[0].selector;
    const sample              = $(containerSelector).first();
    const fields               = inferFields($, sample.get(0), hints);

    return {
      type:      'list',
      container: containerSelector,
      itemCount: repeating[0].count,
      schema:    fields,
      sample:    Object.fromEntries(
        Object.entries(fields).map(([key, def]) => {
          const found = sample.find(def.selector).first();
          const value  = def.attr ? found.attr(def.attr) : found.text().trim();
          return [key, value ?? ''];
        }),
      ),
    };
  }

  const fields = inferFields($, root, hints);

  return {
    type:   'single',
    schema: fields,
  };
}

module.exports = { inferSchema, inferFields, detectRepeatingContainers, buildSelector };
