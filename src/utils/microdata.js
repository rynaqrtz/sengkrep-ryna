function extractJsonLd($) {
  const results = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      results.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      return;
    }
  });
  return results;
}

function extractMicrodataNode($, el) {
  const item = {};
  const type = $(el).attr('itemtype');
  if (type) item['@type'] = type.split('/').pop();

  function collectProps(node) {
    $(node).children().each((_, child) => {
      const hasScope = $(child).attr('itemscope') !== undefined;
      const prop     = $(child).attr('itemprop');

      if (prop) {
        const value = hasScope
          ? extractMicrodataNode($, child)
          : ($(child).attr('content') ?? $(child).attr('href') ?? $(child).attr('src') ?? $(child).text().trim());

        if (item[prop] !== undefined) {
          item[prop] = Array.isArray(item[prop]) ? [...item[prop], value] : [item[prop], value];
        } else {
          item[prop] = value;
        }
      }

      if (!hasScope) collectProps(child);
    });
  }

  collectProps(el);
  return item;
}

function extractMicrodata($) {
  const results = [];
  $('[itemscope]').each((_, el) => {
    const parentScopes = $(el).parents ? $(el).parents('[itemscope]').length : 0;
    if (parentScopes === 0) results.push(extractMicrodataNode($, el));
  });
  return results;
}

function extractDataAttributes($, selector) {
  const results = [];
  $(selector).each((_, el) => {
    const attrs = el.attribs ?? el.attrs ?? {};
    const data  = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('data-')) {
        const camelKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        data[camelKey] = value;
      }
    }
    if (Object.keys(data).length > 0) results.push(data);
  });
  return results;
}

module.exports = { extractJsonLd, extractMicrodata, extractDataAttributes };
