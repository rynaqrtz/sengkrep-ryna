const MAGIC_BYTES = [
  { sig: [0x89, 0x50, 0x4e, 0x47], type: 'image/png' },
  { sig: [0xff, 0xd8, 0xff], type: 'image/jpeg' },
  { sig: [0x47, 0x49, 0x46, 0x38], type: 'image/gif' },
  { sig: [0x25, 0x50, 0x44, 0x46], type: 'application/pdf' },
  { sig: [0x50, 0x4b, 0x03, 0x04], type: 'application/zip' },
  { sig: [0x1f, 0x8b], type: 'application/gzip' },
  { sig: [0x42, 0x5a, 0x68], type: 'application/x-bzip2' },
  { sig: [0x52, 0x49, 0x46, 0x46], type: 'audio/wav', offset: 0, extra: { check: [8, [0x57, 0x41, 0x56, 0x45]] } },
  { sig: [0x4f, 0x67, 0x67, 0x53], type: 'audio/ogg' },
  { sig: [0x49, 0x44, 0x33], type: 'audio/mpeg' },
  { sig: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], type: 'video/mp4' },
  { sig: [0x28, 0xb5, 0x2f, 0xfd], type: 'application/zstd' },
  { sig: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], type: 'application/x-7z-compressed' },
  { sig: [0x42, 0x4d], type: 'image/bmp' },
  { sig: [0x66, 0x4c, 0x61, 0x43], type: 'audio/flac' },
  { sig: [0x77, 0x4f, 0x46, 0x46], type: 'font/woff' },
  { sig: [0x77, 0x4f, 0x46, 0x32], type: 'font/woff2' },
];

const CHARSET_ALIASES = {
  'shift-jis': 'shift_jis',
  sjis:        'shift_jis',
  gb2312:      'gbk',
  big5hkscs:   'big5-hkscs',
  latin1:      'iso-8859-1',
};

function bufferMatchesSignature(buffer, sig) {
  if (buffer.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buffer[i] !== sig[i]) return false;
  }
  return true;
}

function sniffContentType(buffer) {
  for (const entry of MAGIC_BYTES) {
    if (bufferMatchesSignature(buffer, entry.sig)) {
      if (entry.extra) {
        const [offset, extraSig] = entry.extra.check;
        const slice = buffer.slice(offset, offset + extraSig.length);
        if (!bufferMatchesSignature(slice, extraSig)) continue;
      }
      return entry.type;
    }
  }
  return null;
}

function isLikelyBinary(buffer, sampleSize = 2048) {
  const sample = buffer.slice(0, Math.min(sampleSize, buffer.length));
  if (sample.length === 0) return false;

  let nonPrintable = 0;
  let nullBytes    = 0;

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === 0) nullBytes++;
    if (byte < 7 || (byte > 13 && byte < 32) || byte === 127) nonPrintable++;
  }

  if (nullBytes > 0) return true;
  return nonPrintable / sample.length > 0.1;
}

function detectCharsetFromMeta(htmlSample) {
  const metaCharset = htmlSample.match(/<meta[^>]+charset\s*=\s*["']?([a-z0-9_-]+)/i);
  if (metaCharset) return metaCharset[1].toLowerCase();

  const httpEquiv = htmlSample.match(/<meta[^>]+http-equiv\s*=\s*["']content-type["'][^>]+content\s*=\s*["'][^"']*charset=([a-z0-9_-]+)/i);
  if (httpEquiv) return httpEquiv[1].toLowerCase();

  return null;
}

function detectCharsetFromContentType(contentType) {
  if (!contentType) return null;
  const match = contentType.match(/charset=([a-z0-9_-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function detectBOM(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf-8';
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  return null;
}

function normalizeCharset(name) {
  const lower = name.toLowerCase().trim();
  return CHARSET_ALIASES[lower] ?? lower;
}

function decodeBuffer(buffer, options = {}) {
  const bom = detectBOM(buffer);
  const headerCharset = options.headerCharset ? normalizeCharset(options.headerCharset) : null;

  let charset = bom ?? headerCharset;
  let source  = bom ? 'bom' : (headerCharset ? 'header' : null);

  if (!charset) {
    const asciiSample = buffer.slice(0, 4096).toString('latin1');
    const metaCharset  = detectCharsetFromMeta(asciiSample);
    if (metaCharset) {
      charset = normalizeCharset(metaCharset);
      source  = 'meta';
    }
  }

  if (!charset) {
    charset = 'utf-8';
    source  = 'default';
  }

  try {
    const decoder = new TextDecoder(charset, { fatal: false });
    return { text: decoder.decode(buffer), charset, source };
  } catch {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return { text: decoder.decode(buffer), charset: 'utf-8', source: 'fallback' };
  }
}

function inspect(buffer, contentType) {
  const sniffed          = sniffContentType(buffer);
  const binary           = isLikelyBinary(buffer);
  const headerCharset    = detectCharsetFromContentType(contentType);
  const declaredIsText   = !contentType || /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|.*\+(json|xml))/.test(contentType);

  return {
    isBinary:         binary && !headerCharset,
    sniffedType:      sniffed,
    declaredType:     contentType ?? null,
    mismatch:         sniffed !== null && contentType && !contentType.includes(sniffed.split('/')[0]),
    shouldTreatAsText: declaredIsText && !binary,
    size:             buffer.length,
  };
}

module.exports = {
  sniffContentType,
  isLikelyBinary,
  detectCharsetFromMeta,
  detectCharsetFromContentType,
  detectBOM,
  normalizeCharset,
  decodeBuffer,
  inspect,
};
