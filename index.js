const Ryna                                 = require('./src/Ryna');
const { Fetcher, FetchError, TimeoutError, CanceledError } = require('./src/core/Fetcher');
const { Extractor, ExtractionError }       = require('./src/core/Extractor');
const { JsonExtractor, JsonExtractionError } = require('./src/core/JsonExtractor');
const Retry                                = require('./src/core/Retry');
const { ProxyError }                       = require('./src/core/ProxyTunnel');
const Fingerprint                          = require('./src/modules/Fingerprint');
const HealthMonitor                        = require('./src/modules/HealthMonitor');
const DiffDetector                         = require('./src/modules/DiffDetector');
const { SchemaValidator, ValidationError } = require('./src/modules/SchemaValidator');
const Cache                                = require('./src/modules/Cache');
const CookieJar                            = require('./src/modules/CookieJar');
const RateLimiter                          = require('./src/modules/RateLimiter');
const ProxyRotator                         = require('./src/modules/ProxyRotator');
const Interceptors                         = require('./src/modules/Interceptors');
const Webhook                              = require('./src/modules/Webhook');
const Discover                             = require('./src/modules/Discover');
const { exportData, toCSV, toJSON, toNDJSON, toMarkdownTable } = require('./src/utils/exporter');

const _default = new Ryna();

async function sengkrep(url, schema, options = {}) {
  return _default.extract(url, schema, options);
}

sengkrep.create   = (options = {})                                => new Ryna(options);
sengkrep.extract  = (url, schema, options)                        => _default.extract(url, schema, options);
sengkrep.batch    = (urls, schema, options)                       => _default.batch(urls, schema, options);
sengkrep.paginate = (startUrl, paginationConfig, schema, options) => _default.paginate(startUrl, paginationConfig, schema, options);
sengkrep.login    = (url, formData, options)                      => _default.login(url, formData, options);
sengkrep.discover = (origin, options)                              => _default.discover(origin, options);
sengkrep.export   = (input, schema, options)                       => _default.export(input, schema, options);

sengkrep.Ryna            = Ryna;
sengkrep.Fingerprint     = Fingerprint;
sengkrep.HealthMonitor   = HealthMonitor;
sengkrep.DiffDetector    = DiffDetector;
sengkrep.SchemaValidator = SchemaValidator;
sengkrep.Retry           = Retry;
sengkrep.Fetcher         = Fetcher;
sengkrep.Extractor       = Extractor;
sengkrep.JsonExtractor   = JsonExtractor;
sengkrep.Cache           = Cache;
sengkrep.CookieJar       = CookieJar;
sengkrep.RateLimiter     = RateLimiter;
sengkrep.ProxyRotator    = ProxyRotator;
sengkrep.Interceptors    = Interceptors;
sengkrep.Webhook         = Webhook;
sengkrep.Discover        = Discover;

sengkrep.exportData     = exportData;
sengkrep.toCSV          = toCSV;
sengkrep.toJSON         = toJSON;
sengkrep.toNDJSON       = toNDJSON;
sengkrep.toMarkdownTable = toMarkdownTable;

sengkrep.errors = {
  FetchError,
  TimeoutError,
  CanceledError,
  ExtractionError,
  JsonExtractionError,
  ValidationError,
  ProxyError,
};

module.exports = sengkrep;
