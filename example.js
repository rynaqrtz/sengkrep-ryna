const sengkrep = require('./index');

async function main() {
  const basic = await sengkrep('https://books.toscrape.com', {
    title: 'h1',
    price: '.price_color',
    availability: '.instock',
  });
  console.log('basic extract:', basic);

  const scraper = sengkrep.create({
    logLevel: 'info',
    cache: { ttl: 300 },
    fingerprint: { userAgent: 'random', rotateUAOnEachRequest: true },
    retry: { max: 3 },
    health: { alertThreshold: 0.5 },
    validate: {
      title: { required: true, minLength: 2 },
      price: { required: true, pattern: /^£[\d.]+$/ },
    },
  });

  await scraper.export(
    'https://books.toscrape.com/catalogue/page-1.html',
    { title: 'h3 a', price: '.price_color' },
    {
      pagination: { nextSelector: '.next a', itemsSelector: '.product_pod', maxPages: 2, delayBetweenPages: 800 },
      format: 'csv',
      path: './output/books.csv',
    },
  );
  console.log('exported paginated catalog to ./output/books.csv');

  const urls = await scraper.discover('https://books.toscrape.com');
  console.log(`discover: found ${urls.length} urls via sitemap/robots`);
}

main().catch((err) => {
  console.error('demo failed:', err.message);
  process.exit(1);
});
