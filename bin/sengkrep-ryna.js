#!/usr/bin/env node
const sengkrep = require('../index');
const fs       = require('fs');

function parseArgs(argv) {
  const args  = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
        i += 1;
      } else {
        args[key] = next;
        i += 2;
      }
    } else {
      args._.push(token);
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`sengkrep-ryna CLI

Usage:
  sengkrep-ryna fetch <url>
  sengkrep-ryna scrape <url> --schema '<json>' [options]
  sengkrep-ryna discover <origin>

Options for scrape:
  --schema <json>       Required. Extraction schema as JSON string
  --format <fmt>        csv | json | ndjson | markdown (default: json)
  --output <path>       Write result to file instead of stdout
  --pages <n>           Paginate up to n pages
  --next <selector>     CSS selector for next-page link, or "auto"
  --items <selector>    CSS selector for repeated item containers
  --proxy <url>         Proxy URL to route requests through
  --delay <ms>          Base delay between requests

Examples:
  sengkrep-ryna fetch https://example.com
  sengkrep-ryna scrape https://books.toscrape.com --schema '{"title":"h1"}' --format csv --output books.csv
`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (args.help || args.h) {
    printHelp();
    return;
  }

  if (command === 'fetch') {
    const url = args._[0];
    if (!url) throw new Error('Usage: sengkrep-ryna fetch <url>');
    const res = await sengkrep.fetch(url);
    process.stdout.write(res.body + '\n');
    return;
  }

  if (command === 'discover') {
    const origin = args._[0];
    if (!origin) throw new Error('Usage: sengkrep-ryna discover <origin>');
    const urls = await sengkrep.discover(origin);
    console.log(urls.join('\n'));
    return;
  }

  if (command === 'scrape') {
    const url = args._[0];
    if (!url) throw new Error('Usage: sengkrep-ryna scrape <url> --schema \'<json>\'');
    if (!args.schema) throw new Error('--schema is required, e.g. --schema \'{"title":"h1"}\'');

    const schema = JSON.parse(args.schema);
    const scraper = sengkrep.create({
      logLevel: 'warn',
      proxies: args.proxy ? [args.proxy] : [],
      delay:   args.delay ? parseInt(args.delay, 10) : undefined,
    });

    const exportOptions = { format: args.format ?? 'json' };
    if (args.output) exportOptions.path = args.output;

    if (args.pages) {
      exportOptions.pagination = {
        nextSelector:  args.next ?? 'auto',
        itemsSelector: args.items ?? null,
        maxPages:      parseInt(args.pages, 10),
      };
    }

    const output = await scraper.export(url, schema, exportOptions);

    if (args.output) {
      console.log(`Written to ${args.output}`);
    } else {
      process.stdout.write(output + '\n');
    }
    return;
  }

  throw new Error(`Unknown command: ${command}. Run "sengkrep-ryna help" for usage.`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
