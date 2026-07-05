const fs   = require('fs');
const path = require('path');

function toArray(data) {
  return Array.isArray(data) ? data : [data];
}

function flattenValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(' | ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsvField(value) {
  const str = flattenValue(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(data) {
  const rows = toArray(data);
  if (rows.length === 0) return '';

  const keys   = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const header = keys.map(escapeCsvField).join(',');
  const lines  = rows.map(row => keys.map(k => escapeCsvField(row[k])).join(','));

  return [header, ...lines].join('\n');
}

function toJSON(data) {
  return JSON.stringify(toArray(data), null, 2);
}

function toNDJSON(data) {
  return toArray(data).map(row => JSON.stringify(row)).join('\n');
}

function toMarkdownTable(data) {
  const rows = toArray(data);
  if (rows.length === 0) return '';

  const keys      = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const header     = `| ${keys.join(' | ')} |`;
  const separator = `| ${keys.map(() => '---').join(' | ')} |`;
  const lines      = rows.map(row => `| ${keys.map(k => flattenValue(row[k]).replace(/\|/g, '\\|')).join(' | ')} |`);

  return [header, separator, ...lines].join('\n');
}

const FORMATTERS = {
  csv:      toCSV,
  json:     toJSON,
  ndjson:   toNDJSON,
  markdown: toMarkdownTable,
};

function exportData(data, options = {}) {
  const format = options.format ?? 'json';
  const formatter = FORMATTERS[format];

  if (!formatter) {
    throw new Error(`Unknown export format: "${format}". Use: csv, json, ndjson, markdown`);
  }

  const content = formatter(data);

  if (options.path) {
    const dir = path.dirname(options.path);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(options.path, content, 'utf8');
  }

  return content;
}

module.exports = { exportData, toCSV, toJSON, toNDJSON, toMarkdownTable };
