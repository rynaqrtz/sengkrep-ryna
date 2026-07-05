const cheerio = require('cheerio');

function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });

  if ($('rss').length > 0 || $('channel').length > 0) {
    const items = $('item').map((_, el) => ({
      title:       $(el).find('title').first().text().trim(),
      link:        $(el).find('link').first().text().trim(),
      pubDate:     $(el).find('pubDate').first().text().trim() || null,
      description: $(el).find('description').first().text().trim() || null,
      guid:        $(el).find('guid').first().text().trim() || null,
    })).get();

    return {
      type:  'rss',
      title: $('channel > title').first().text().trim(),
      items,
    };
  }

  if ($('feed').length > 0) {
    const entries = $('entry').map((_, el) => ({
      title:   $(el).find('title').first().text().trim(),
      link:    $(el).find('link').first().attr('href') ?? $(el).find('link').first().text().trim(),
      updated: $(el).find('updated').first().text().trim() || null,
      summary: $(el).find('summary').first().text().trim() || $(el).find('content').first().text().trim() || null,
      id:      $(el).find('id').first().text().trim() || null,
    })).get();

    return {
      type:  'atom',
      title: $('feed > title').first().text().trim(),
      items: entries,
    };
  }

  return { type: 'unknown', title: null, items: [] };
}

function parseCSVLine(line) {
  const fields = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;
    if (char === '"') inQuotes = !inQuotes;
    if (char === '\n' && !inQuotes) {
      rows.push(current);
      current = '';
    }
  }
  if (current.trim()) rows.push(current);

  const lines  = rows.map(r => r.replace(/\r?\n$/, '')).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj    = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

module.exports = { parseFeed, parseCSV, parseCSVLine };
