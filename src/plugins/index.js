const fs = require('fs');

function timestamp(fieldName = 'scrapedAt') {
  return {
    afterExtract({ data, meta }) {
      data[fieldName] = new Date().toISOString();
      return { data, meta };
    },
  };
}

function logToFile(filePath) {
  return {
    afterExtract({ data, meta }) {
      fs.appendFileSync(filePath, `${JSON.stringify(data)}\n`, 'utf8');
      return { data, meta };
    },
  };
}

function fieldMapper(mapping) {
  return {
    afterExtract({ data, meta }) {
      const mapped = { ...data };
      for (const [from, to] of Object.entries(mapping)) {
        if (from in mapped) {
          mapped[to] = mapped[from];
          if (from !== to) delete mapped[from];
        }
      }
      return { data: mapped, meta };
    },
  };
}

module.exports = { timestamp, logToFile, fieldMapper };
