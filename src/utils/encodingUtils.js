const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', hellip: '\u2026',
  mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', bull: '\u2022', deg: '\u00b0',
};

function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function decodeUnicodeEscapes(text) {
  return text
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const HEX_RE    = /^[0-9a-f]+$/i;

function looksLikeBase64(str) {
  const trimmed = str.trim();
  return trimmed.length > 0 && trimmed.length % 4 === 0 && BASE64_RE.test(trimmed);
}

function looksLikeHex(str) {
  const trimmed = str.trim();
  return trimmed.length > 0 && trimmed.length % 2 === 0 && HEX_RE.test(trimmed);
}

function decodeBase64(str) {
  return Buffer.from(str.trim(), 'base64').toString('utf8');
}

function decodeHex(str) {
  return Buffer.from(str.trim(), 'hex').toString('utf8');
}

function detectAndDecode(str) {
  const trimmed = str.trim();
  if (looksLikeHex(trimmed))    return { encoding: 'hex', decoded: decodeHex(trimmed) };
  if (looksLikeBase64(trimmed)) return { encoding: 'base64', decoded: decodeBase64(trimmed) };
  return { encoding: null, decoded: str };
}

function xorDecode(str, key) {
  const input  = Buffer.isBuffer(str) ? str : Buffer.from(str, 'binary');
  const keyBuf = Buffer.from(String(key));
  const out    = Buffer.alloc(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] ^ keyBuf[i % keyBuf.length];
  }
  return out;
}

function caesarDecode(str, shift) {
  return str.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base - shift + 26) % 26) + base);
  });
}

function rot13(str) {
  return caesarDecode(str, 13);
}

function parseJSONP(text) {
  const match = text.trim().match(/^\/\*\*\/\s*([a-zA-Z_$][\w$.]*)\s*\((.*)\)\s*;?\s*$/s)
    ?? text.trim().match(/^([a-zA-Z_$][\w$.]*)\s*\((.*)\)\s*;?\s*$/s);

  if (!match) return null;

  try {
    return { callback: match[1], data: JSON.parse(match[2]) };
  } catch {
    return null;
  }
}

module.exports = {
  decodeHtmlEntities,
  decodeUnicodeEscapes,
  looksLikeBase64,
  looksLikeHex,
  decodeBase64,
  decodeHex,
  detectAndDecode,
  xorDecode,
  caesarDecode,
  rot13,
  parseJSONP,
};
