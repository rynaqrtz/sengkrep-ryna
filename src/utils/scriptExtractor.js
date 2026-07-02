function extractScripts($, baseUrl) {
  const scripts = [];

  $('script').each((_, el) => {
    const src  = $(el).attr('src');
    const type = $(el).attr('type') ?? 'text/javascript';

    if (src) {
      let absoluteSrc = src;
      try {
        absoluteSrc = new URL(src, baseUrl).href;
      } catch {
        absoluteSrc = src;
      }
      scripts.push({ inline: false, src: absoluteSrc, type, content: null });
    } else {
      const content = $(el).html();
      if (content && content.trim()) {
        scripts.push({ inline: true, src: null, type, content });
      }
    }
  });

  return scripts;
}

function extractSourceMapUrl(jsText) {
  const match = jsText.match(/\/\/[#@]\s*sourceMappingURL=(\S+)/);
  return match ? match[1] : null;
}

function beautify(jsText, indentSize = 2) {
  const indent = ' '.repeat(indentSize);
  let depth    = 0;
  let output   = '';
  let inString = null;

  for (let i = 0; i < jsText.length; i++) {
    const char = jsText[i];
    const prev = jsText[i - 1];

    if (inString) {
      output += char;
      if (char === inString && prev !== '\\') inString = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      output += char;
      continue;
    }

    if (char === '{' || char === '[') {
      depth++;
      output += char + '\n' + indent.repeat(depth);
      continue;
    }

    if (char === '}' || char === ']') {
      depth = Math.max(0, depth - 1);
      output = output.replace(/[ \t]*$/, '');
      output += '\n' + indent.repeat(depth) + char;
      continue;
    }

    if (char === ';' && jsText[i + 1] !== '\n') {
      output += char + '\n' + indent.repeat(depth);
      continue;
    }

    if (char === ',' && (jsText[i + 1] === '"' || jsText[i + 1] === "'" || jsText[i + 1] === '{')) {
      output += char + '\n' + indent.repeat(depth);
      continue;
    }

    output += char;
  }

  return output.replace(/\n[ \t]*\n/g, '\n').replace(/^\s+|\s+$/g, '');
}

module.exports = { extractScripts, extractSourceMapUrl, beautify };
