const cheerio                              = require('cheerio');
const Ryna                                 = require('./src/Ryna');
const { Fetcher, FetchError, TimeoutError, CanceledError } = require('./src/core/Fetcher');
const { Http2Fetcher, Http2Error }         = require('./src/core/Http2Fetcher');
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
const { SecurityGuard, SecurityError }     = require('./src/modules/SecurityGuard');
const { CircuitBreaker, CircuitOpenError } = require('./src/modules/CircuitBreaker');
const Incremental                          = require('./src/modules/Incremental');
const CsrfHandler                          = require('./src/modules/CsrfHandler');
const AuthManager                          = require('./src/modules/AuthManager');
const SessionPool                          = require('./src/modules/SessionPool');
const PluginSystem                         = require('./src/modules/PluginSystem');
const CrawlQueue                           = require('./src/modules/CrawlQueue');
const Observability                        = require('./src/modules/Observability');
const HarRecorder                          = require('./src/modules/HarRecorder');
const WordPress                            = require('./src/modules/WordPress');
const GraphQLClient                        = require('./src/modules/GraphQLClient');
const DnsCache                             = require('./src/modules/DnsCache');
const FormHandler                          = require('./src/modules/FormHandler');
const ProgressBar                          = require('./src/modules/ProgressBar');
const PaginationDetector                   = require('./src/modules/PaginationDetector');
const builtinPlugins                       = require('./src/plugins');
const { exportData, toCSV, toJSON, toNDJSON, toMarkdownTable } = require('./src/utils/exporter');
const { parseFeed, parseCSV }              = require('./src/utils/contentHandlers');
const { extractJsonLd, extractMicrodata, extractDataAttributes } = require('./src/utils/microdata');
const { extractScripts, extractSourceMapUrl, beautify } = require('./src/utils/scriptExtractor');
const { normalizeUrl, extractLinks, UrlDeduplicator } = require('./src/utils/urlUtils');
const StreamWriter                         = require('./src/utils/streamWriter');
const contentSafety                        = require('./src/utils/contentSafety');
const encodingUtils                        = require('./src/utils/encodingUtils');

const _default = new Ryna();

async function sengkrep(url, schema, options = {}) {
  return _default.extract(url, schema, options);
}

sengkrep.create   = (options = {})                                => new Ryna(options);
sengkrep.fetch    = (url, options)                                 => _default.fetch(url, options);
sengkrep.load     = (html)                                          => _default.load(html);
sengkrep.extract  = (url, schema, options)                        => _default.extract(url, schema, options);
sengkrep.batch    = (urls, schema, options)                       => _default.batch(urls, schema, options);
sengkrep.stream   = (urls, schema, options)                       => _default.stream(urls, schema, options);
sengkrep.paginate = (startUrl, paginationConfig, schema, options) => _default.paginate(startUrl, paginationConfig, schema, options);
sengkrep.login    = (url, formData, options)                      => _default.login(url, formData, options);
sengkrep.discover = (origin, options)                              => _default.discover(origin, options);
sengkrep.export   = (input, schema, options)                       => _default.export(input, schema, options);
sengkrep.crawl    = (options)                                       => _default.crawl(options);
sengkrep.submitForm = (url, formSelector, overrides)                 => _default.submitForm(url, formSelector, overrides);

sengkrep.Ryna             = Ryna;
sengkrep.Fingerprint      = Fingerprint;
sengkrep.HealthMonitor    = HealthMonitor;
sengkrep.DiffDetector     = DiffDetector;
sengkrep.SchemaValidator  = SchemaValidator;
sengkrep.Retry            = Retry;
sengkrep.Fetcher          = Fetcher;
sengkrep.Http2Fetcher     = Http2Fetcher;
sengkrep.Extractor        = Extractor;
sengkrep.JsonExtractor    = JsonExtractor;
sengkrep.Cache            = Cache;
sengkrep.CookieJar        = CookieJar;
sengkrep.RateLimiter      = RateLimiter;
sengkrep.ProxyRotator     = ProxyRotator;
sengkrep.Interceptors     = Interceptors;
sengkrep.Webhook          = Webhook;
sengkrep.Discover         = Discover;
sengkrep.SecurityGuard    = SecurityGuard;
sengkrep.CircuitBreaker   = CircuitBreaker;
sengkrep.Incremental      = Incremental;
sengkrep.CsrfHandler      = CsrfHandler;
sengkrep.AuthManager      = AuthManager;
sengkrep.SessionPool      = SessionPool;
sengkrep.PluginSystem     = PluginSystem;
sengkrep.CrawlQueue       = CrawlQueue;
sengkrep.Observability    = Observability;
sengkrep.HarRecorder      = HarRecorder;
sengkrep.WordPress        = WordPress;
sengkrep.GraphQLClient    = GraphQLClient;
sengkrep.DnsCache         = DnsCache;
sengkrep.FormHandler      = FormHandler;
sengkrep.ProgressBar      = ProgressBar;
sengkrep.PaginationDetector = PaginationDetector;
sengkrep.UrlDeduplicator  = UrlDeduplicator;
sengkrep.StreamWriter     = StreamWriter;
sengkrep.plugins          = builtinPlugins;
sengkrep.cheerio          = cheerio;

sengkrep.exportData      = exportData;
sengkrep.toCSV           = toCSV;
sengkrep.toJSON          = toJSON;
sengkrep.toNDJSON        = toNDJSON;
sengkrep.toMarkdownTable = toMarkdownTable;
sengkrep.parseFeed       = parseFeed;
sengkrep.parseCSV        = parseCSV;
sengkrep.extractJsonLd   = extractJsonLd;
sengkrep.extractMicrodata = extractMicrodata;
sengkrep.extractDataAttributes = extractDataAttributes;
sengkrep.extractScripts  = extractScripts;
sengkrep.extractSourceMapUrl = extractSourceMapUrl;
sengkrep.beautifyJs      = beautify;
sengkrep.normalizeUrl    = normalizeUrl;
sengkrep.extractLinks    = extractLinks;
sengkrep.contentSafety   = contentSafety;

sengkrep.decodeHtmlEntities   = encodingUtils.decodeHtmlEntities;
sengkrep.decodeUnicodeEscapes = encodingUtils.decodeUnicodeEscapes;
sengkrep.decodeBase64         = encodingUtils.decodeBase64;
sengkrep.decodeHex            = encodingUtils.decodeHex;
sengkrep.detectAndDecode      = encodingUtils.detectAndDecode;
sengkrep.xorDecode            = encodingUtils.xorDecode;
sengkrep.caesarDecode         = encodingUtils.caesarDecode;
sengkrep.rot13                = encodingUtils.rot13;
sengkrep.parseJSONP           = encodingUtils.parseJSONP;

sengkrep.errors = {
  FetchError,
  TimeoutError,
  CanceledError,
  Http2Error,
  ExtractionError,
  JsonExtractionError,
  ValidationError,
  ProxyError,
  SecurityError,
  CircuitOpenError,
};

module.exports = sengkrep;
