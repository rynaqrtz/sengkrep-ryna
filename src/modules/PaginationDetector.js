const NEXT_TEXT_PATTERNS = [/^next$/i, /^next\s*›?$/i, /^»$/, /^›$/, /^more$/i, /^load more$/i, /^selanjutnya$/i];
const NEXT_CLASS_PATTERNS = [/next/i, /pagination-next/i, /pager-next/i];
const PAGE_NUMBER_SELECTORS = ['.page-numbers', '.pagination a', '.pagination li', '.nav-links a', '.pager a'];

function detectTotalPages($) {
  let maxPage = 1;

  for (const selector of PAGE_NUMBER_SELECTORS) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      const num  = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num) && num > maxPage) maxPage = num;
    });
  }

  return maxPage;
}

function detectNextLink($, currentUrl) {
  const relNext = $('link[rel="next"]').attr('href') ?? $('a[rel="next"]').attr('href');
  if (relNext) {
    try {
      return { selector: 'a[rel="next"], link[rel="next"]', url: new URL(relNext, currentUrl).href, method: 'rel' };
    } catch {
      return null;
    }
  }

  let found = null;

  $('a[href]').each((_, el) => {
    if (found) return;
    const text  = $(el).text().trim();
    const attrs = el.attribs ?? el.attrs ?? {};
    const cls   = attrs.class ?? '';

    const textMatches  = NEXT_TEXT_PATTERNS.some(p => p.test(text));
    const classMatches = NEXT_CLASS_PATTERNS.some(p => p.test(cls));

    if (textMatches || classMatches) {
      try {
        found = { selector: null, url: new URL(attrs.href, currentUrl).href, method: textMatches ? 'text' : 'class' };
      } catch {
        found = null;
      }
    }
  });

  if (found) return found;

  return detectFromUrlPattern(currentUrl);
}

function detectFromUrlPattern(currentUrl) {
  try {
    const parsed = new URL(currentUrl);
    const pageParam = ['page', 'p', 'pg'].find(name => parsed.searchParams.has(name));
    if (pageParam) {
      const current = parseInt(parsed.searchParams.get(pageParam), 10);
      if (!isNaN(current)) {
        parsed.searchParams.set(pageParam, current + 1);
        return { selector: null, url: parsed.href, method: 'url-param', currentPage: current };
      }
    }

    const pathMatch = parsed.pathname.match(/\/page[/-](\d+)/i) ?? parsed.pathname.match(/[/-](\d+)\/?$/);
    if (pathMatch) {
      const current = parseInt(pathMatch[1], 10);
      const next    = current + 1;
      parsed.pathname = parsed.pathname.replace(pathMatch[0], pathMatch[0].replace(String(current), String(next)));
      return { selector: null, url: parsed.href, method: 'url-path', currentPage: current };
    }
  } catch {
    return null;
  }

  return null;
}

module.exports = { detectNextLink, detectFromUrlPattern, detectTotalPages };
