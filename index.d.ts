import type { CheerioAPI } from 'cheerio';

export type FieldSelector = string | string[];

export interface FieldDefinition {
  selector: FieldSelector;
  required?: boolean;
  multiple?: boolean;
  attr?: string;
  type?: 'text' | 'html';
  transform?: (value: string) => unknown;
  pattern?: RegExp;
  default?: unknown;
}

export type SchemaField = string | string[] | FieldDefinition;

export type Schema<T = Record<string, unknown>> = {
  [K in keyof T]: SchemaField;
};

export interface JsonFieldDefinition {
  path: string | string[];
  required?: boolean;
  transform?: (value: unknown) => unknown;
  pattern?: RegExp;
  default?: unknown;
}

export type JsonSchemaField = string | string[] | JsonFieldDefinition;

export type JsonSchema<T = Record<string, unknown>> = {
  [K in keyof T]: JsonSchemaField;
};

export interface HealthAlert {
  field: string;
  selector: string;
  type: 'high_empty_rate' | 'count_drop' | 'pattern_mismatch';
  message: string;
}

export interface HealthReport {
  url: string;
  alerts: HealthAlert[];
  healthy: boolean;
}

export interface DiffChange {
  type: string;
  severity: 'info' | 'warn' | 'critical';
  [key: string]: unknown;
}

export interface DiffReport {
  url: string;
  firstRun: boolean;
  changes: DiffChange[];
  hasCritical: boolean;
  hasWarn?: boolean;
  previousTs: number | null;
}

export interface ValidationErrorDetail {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: ValidationErrorDetail[];
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetSeconds: number | null;
}

export interface RynaMeta {
  responseType: 'html' | 'json' | 'feed' | 'csv' | 'binary' | 'streamed';
  cache?: { hit: boolean };
  health?: HealthReport;
  diff?: DiffReport;
  validation?: ValidationReport;
  sniffedType?: string | null;
  filePath?: string | null;
  size?: number | null;
  rateLimit?: RateLimitInfo;
}

export type ExtractResult<T = Record<string, unknown>> = T & {
  readonly _ryna: RynaMeta;
};

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  url: string;
  body: string;
  binary: boolean;
  streamed: boolean;
  filePath: string | null;
  fromCache: boolean;
  notModified: boolean;
  charset?: string;
}

export interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  signal?: AbortSignal;
  rejectUnauthorized?: boolean;
  timeout?: number;
  proxy?: string | null;
}

export interface ExtractOptions {
  strict?: boolean;
  responseType?: 'auto' | 'html' | 'json' | 'rss' | 'csv';
  params?: Record<string, string | number>;
  allowBinary?: boolean;
  allowStreamed?: boolean;
  includeBuffer?: boolean;
  request?: RequestConfig;
}

export interface BatchOptions extends ExtractOptions {
  concurrency?: number;
  delay?: number;
  randomOrder?: boolean;
  progressBar?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface BatchResult<T = Record<string, unknown>> {
  url: string;
  data: ExtractResult<T> | null;
  error: Error | null;
}

export interface PaginationConfig {
  nextSelector: string | 'auto';
  itemsSelector?: string | null;
  maxPages?: number;
  delayBetweenPages?: number;
  stopOnDuplicate?: boolean;
}

export interface CrawlOptions {
  seed: string | string[];
  schema?: Record<string, SchemaField>;
  follow?: RegExp | ((url: string) => boolean);
  maxUrls?: number;
  concurrency?: number;
  stateFile?: string | null;
  saveEvery?: number;
  linkOptions?: Record<string, unknown>;
  respectRobotsTxt?: boolean;
  userAgent?: string;
}

export interface CrawlJob {
  queue: unknown;
  start: () => Promise<Array<{ url: string; data: unknown }>>;
  resume: () => Promise<Array<{ url: string; data: unknown }>>;
  pause: () => void;
  on: (event: 'url:done' | 'url:error' | 'progress' | 'start' | 'done', fn: (payload: any) => void) => void;
  results: () => Array<{ url: string; data: unknown }>;
  stats: () => { visited: number; queued: number; results: number };
}

export interface SchemaInferenceField {
  selector: string;
  confidence: number;
  attr?: string;
}

export interface SchemaInferenceResult {
  type: 'list' | 'single';
  container?: string;
  itemCount?: number;
  schema: Record<string, SchemaInferenceField>;
  sample?: Record<string, string>;
}

export interface FingerprintOptions {
  userAgent?: string | 'random';
  rotateUAOnEachRequest?: boolean;
  randomizeHeaderOrder?: boolean;
  randomizeTiming?: boolean;
}

export interface RetryOptions {
  max?: number;
  jitter?: boolean;
  retryOn?: number[];
  retryOnNetwork?: boolean;
  retryOnTimeout?: boolean;
  respectRetryAfter?: boolean;
  maxRetryAfter?: number;
  onRetry?: (info: { attempt: number; status: number | null; code: string | null; waitMs: number; respectedRetryAfter: boolean }) => void;
}

export interface HealthOptions {
  alertThreshold?: number;
  windowSize?: number;
  onAlert?: (report: HealthReport) => void;
}

export interface DiffOptions {
  storageDir?: string;
  sensitivity?: 'structural' | 'value';
  onDiff?: (report: DiffReport) => void;
  maxHistory?: number;
}

export interface CacheOptions {
  ttl?: number;
  storage?: 'memory' | 'disk';
  storageDir?: string;
  maxItems?: number;
}

export interface RateLimitOptions {
  requestsPerSecond?: number | null;
  concurrency?: number | null;
}

export interface SecurityOptions {
  blockPrivateIPs?: boolean;
  allowDomains?: string[] | null;
  blockDomains?: string[];
  blockedPorts?: number[];
}

export interface CircuitBreakerOptions {
  threshold?: number;
  cooldown?: number;
  halfOpenMaxAttempts?: number;
  onOpen?: (info: { key: string; failures: number }) => void;
  onClose?: (info: { key: string }) => void;
}

export interface AuthOptions {
  type?: 'bearer';
  token?: string | null;
  refresh?: ((oldToken: string | null) => Promise<string>) | null;
  refreshOn?: number[];
  headerName?: string;
  onRefresh?: (newToken: string) => void;
}

export interface CsrfOptions {
  auto?: boolean;
  headerName?: string;
  fieldName?: string;
  cookieNames?: string[];
  metaSelectors?: string[];
  inputSelectors?: string[];
}

export interface SessionPoolOptions {
  size?: number;
  strategy?: 'round-robin' | 'least-used';
  recycleAfter?: number | null;
  fingerprint?: FingerprintOptions;
}

export interface ObservabilityOptions {
  enabled?: boolean;
  port?: number | null;
}

export interface WebhookOptions {
  onStart?: string | null;
  onComplete?: string | null;
  onError?: string | null;
  onProgress?: string | null;
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'date';
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  notEmpty?: boolean;
  custom?: (value: unknown, allData: Record<string, unknown>) => true | string;
}

export interface RynaOptions {
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  logPretty?: boolean;
  baseURL?: string | null;
  timeout?: number;
  maxRedirects?: number;
  keepAlive?: boolean;
  delay?: number;
  delayMin?: number;
  delayMax?: number;
  maxMemoryBuffer?: number;
  responseType?: 'auto' | 'html' | 'json' | 'rss' | 'csv';
  cookies?: boolean;
  http2?: boolean;
  fingerprint?: FingerprintOptions;
  retry?: RetryOptions;
  health?: HealthOptions | false;
  diff?: DiffOptions | false;
  cache?: CacheOptions | false;
  circuitBreaker?: CircuitBreakerOptions | false;
  incremental?: { storageDir?: string } | boolean;
  rateLimit?: RateLimitOptions;
  proxies?: string[];
  proxyStrategy?: 'round-robin' | 'random' | 'sticky';
  proxyMaxFailures?: number;
  dns?: { ttl?: number } | boolean;
  sessionPool?: SessionPoolOptions;
  security?: SecurityOptions;
  auth?: AuthOptions;
  csrf?: CsrfOptions;
  observability?: ObservabilityOptions;
  webhook?: WebhookOptions;
  har?: boolean;
  validate?: Record<string, ValidationRule>;
}

export class FetchError extends Error {
  status: number | null;
  code: string;
  retryAfterMs?: number | null;
  headers?: Record<string, string | string[] | undefined>;
}
export class TimeoutError extends FetchError {}
export class CanceledError extends FetchError {}
export class ProxyError extends Error {
  code: string;
}
export class ExtractionError extends Error {
  field: string;
  selector: string;
}
export class JsonExtractionError extends Error {
  field: string | null;
  path: string | null;
}
export class ValidationError extends Error {
  errors: ValidationErrorDetail[];
}
export class SecurityError extends Error {
  code: string;
}
export class CircuitOpenError extends Error {
  code: string;
  key: string;
  retryAt: number;
}

export class Fingerprint {
  constructor(options?: FingerprintOptions);
  buildHeaders(extra?: Record<string, string>, context?: { referer?: string; targetUrl?: string } | null): Record<string, string>;
  getUA(): string;
  humanDelay(min?: number, max?: number): Promise<void>;
}

export class HealthMonitor {
  constructor(options?: HealthOptions);
  record(url: string, healthMap: Record<string, unknown>): HealthReport;
  getReport(url: string): unknown;
  getAllReports(): unknown[];
  reset(url?: string): void;
}

export class DiffDetector {
  constructor(options?: DiffOptions);
  check(url: string, data: unknown): DiffReport;
  getAllChanges(url?: string): DiffReport[];
  getChangedOnly(url?: string): DiffReport[];
  clearHistory(): void;
  clearSnapshot(url: string): void;
  clearAll(): void;
}

export class SchemaValidator {
  constructor(rules: Record<string, ValidationRule>);
  validate(data: Record<string, unknown>): ValidationReport;
  validateMany(items: Record<string, unknown>[]): (ValidationReport & { index: number })[];
}

export class Cache {
  constructor(options?: CacheOptions);
  get(url: string, method?: string): unknown;
  set(url: string, data: unknown, method?: string): void;
  has(url: string, method?: string): boolean;
  delete(url: string, method?: string): void;
  clear(): void;
  stats(): { hits: number; misses: number; sets: number; size: number; hitRate: number };
}

export class CookieJar {
  getCookieHeader(hostname: string): string | null;
  getAll(hostname: string): unknown[];
  setManual(hostname: string, name: string, value: string, options?: Record<string, unknown>): void;
  export(): Record<string, unknown[]>;
  import(snapshot: Record<string, unknown[]>): void;
  clear(hostname?: string): void;
}

export class RateLimiter {
  constructor(options?: RateLimitOptions);
  readonly enabled: boolean;
  acquire(hostname: string): Promise<() => void>;
}

export class ProxyRotator {
  constructor(options?: { proxies?: string[]; strategy?: string; maxFailures?: number });
  readonly enabled: boolean;
  next(hostname?: string): string | null;
  reportSuccess(proxy: string): void;
  reportFailure(proxy: string): void;
  stats(): Array<{ proxy: string; failures: number; healthy: boolean }>;
}

export class Interceptors {
  request: { use: (onFulfilled?: Function, onRejected?: Function) => number; eject: (id: number) => void };
  response: { use: (onFulfilled?: Function, onRejected?: Function) => number; eject: (id: number) => void };
}

export class Webhook {
  constructor(config?: WebhookOptions);
  fire(event: string, payload?: Record<string, unknown>): void;
}

export class Discover {
  discover(origin: string, options?: { maxDepth?: number; maxEntries?: number; pattern?: RegExp }): Promise<string[]>;
  isAllowed(url: string, userAgent?: string): Promise<boolean>;
  getCrawlDelay(origin: string, userAgent?: string): Promise<number | null>;
}

export class SecurityGuard {
  constructor(options?: SecurityOptions);
  readonly enabled: boolean;
  check(url: string): Promise<boolean>;
}

export class CircuitBreaker {
  constructor(options?: CircuitBreakerOptions);
  canRequest(key: string): boolean;
  assertCanRequest(key: string): void;
  recordSuccess(key: string): void;
  recordFailure(key: string): void;
  getState(key: string): { key: string; state: string; failures: number; openedAt: number | null };
  getAllStates(): unknown[];
  reset(key?: string): void;
}

export class Incremental {
  constructor(options?: { storageDir?: string });
  getConditionalHeaders(url: string): Record<string, string>;
  hasSnapshot(url: string): boolean;
  getSnapshot(url: string): unknown;
  record(url: string, headers: Record<string, unknown>, extracted: unknown): void;
  clear(url?: string): void;
}

export class CsrfHandler {
  constructor(options?: CsrfOptions);
  readonly enabled: boolean;
  extractFromHtml($: CheerioAPI): string | null;
  extractFromCookies(cookieJar: CookieJar | null, hostname: string): string | null;
  buildFormBody(fields: Record<string, unknown>, token: string | null): string;
  buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string>;
}

export class AuthManager {
  constructor(options?: AuthOptions);
  readonly enabled: boolean;
  token: string | null;
  buildHeaders(extra?: Record<string, string>): Record<string, string>;
  shouldRefresh(status: number): boolean;
  refresh(): Promise<string | null>;
}

export interface SessionPoolSession {
  id: number;
  cookieJar: CookieJar;
  fingerprint: Fingerprint;
  useCount: number;
  createdAt: number;
}

export class SessionPool {
  constructor(options?: SessionPoolOptions);
  next(): SessionPoolSession;
  get(id: number): SessionPoolSession | null;
  stats(): Array<{ id: number; useCount: number; createdAt: number }>;
  resetAll(): void;
}

export interface PluginHooks {
  beforeRequest?: (payload: { url: string; options: ExtractOptions }) => unknown;
  afterExtract?: (payload: { data: Record<string, unknown>; meta: RynaMeta }) => unknown;
  onError?: (payload: { url: string; error: Error }) => unknown;
}

export class PluginSystem {
  use(plugin: PluginHooks | ((system: PluginSystem) => void)): this;
  hook(name: string, fn: Function): this;
  run(hookName: string, payload: unknown): Promise<unknown>;
}

export class CrawlQueue {
  constructor(options: CrawlOptions);
  start(visitFn: (url: string) => Promise<{ data: unknown; links: string[] }>): Promise<Array<{ url: string; data: unknown }>>;
  resume(visitFn: (url: string) => Promise<{ data: unknown; links: string[] }>): Promise<Array<{ url: string; data: unknown }>>;
  pause(): void;
  on(event: string, fn: (payload: any) => void): void;
  results(): Array<{ url: string; data: unknown }>;
  stats(): { visited: number; queued: number; results: number };
}

export interface ObservabilityReport {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  rps: number;
  elapsedSec: number;
  domains: Record<string, { requests: number; success: number; failed: number }>;
  categories: Record<string, number>;
  bytes: { sent: number; received: number };
  topErrors: Array<{ code: string; count: number }>;
}

export class Observability {
  constructor(options?: ObservabilityOptions);
  recordSuccess(url: string): void;
  recordFailure(url: string, err: Error): void;
  report(): ObservabilityReport;
  close(): void;
}

export class HarRecorder {
  attach(interceptors: Interceptors): this;
  toHAR(): Record<string, unknown>;
  save(filePath: string): void;
  clear(): void;
}

export class WordPress {
  detect(origin: string): Promise<{ isWordPress: boolean; name?: string | null; namespaces?: string[] }>;
  restApi(origin: string, endpoint: string, params?: Record<string, unknown>): Promise<{ data: unknown; total: number | null; totalPages: number | null }>;
  restApiAll(origin: string, endpoint: string, params?: Record<string, unknown>, options?: { maxPages?: number }): Promise<unknown[]>;
  extractNonce(html: string): string | null;
  ajaxAction(origin: string, action: string, data?: Record<string, unknown>, options?: { nonce?: string; nonceFromPage?: string }): Promise<unknown>;
}

export class GraphQLClient {
  introspect(endpoint: string, options?: { headers?: Record<string, string> }): Promise<{ queryType: string | null; types: Record<string, unknown> }>;
  query<T = unknown>(endpoint: string, queryString: string, variables?: Record<string, unknown>, options?: { headers?: Record<string, string> }): Promise<T>;
  flattenConnection<T = unknown>(connectionObj: { edges: Array<{ node: T }> }): T[];
  queryAllPages<T = unknown>(endpoint: string, queryString: string, options: { variables?: Record<string, unknown>; connectionPath: string; maxPages?: number; pageSize?: number; headers?: Record<string, string> }): Promise<T[]>;
}

export class DnsCache {
  constructor(options?: { ttl?: number; enabled?: boolean });
  lookup(hostname: string): Promise<string>;
  invalidate(hostname?: string): void;
  stats(): Array<{ hostname: string; addresses: string[]; ageMs: number }>;
}

export interface ParsedForm {
  action: string;
  method: string;
  fields: Record<string, unknown>;
}

export class FormHandler {
  constructor(options?: { csrf?: CsrfOptions });
  parse($: CheerioAPI, selector: string, baseUrl: string): ParsedForm | null;
  buildSubmission(parsedForm: ParsedForm, overrides?: Record<string, unknown>): { url: string; method: string; body: string; headers: Record<string, string> };
}

export class ProgressBar {
  constructor(options?: { total?: number; width?: number; label?: string; enabled?: boolean });
  update(current: number, extra?: string): void;
  increment(step?: number, extra?: string): void;
  finish(message?: string): void;
}

export class StreamWriter {
  constructor(filePath: string, options?: { format?: 'csv' | 'jsonl'; keys?: string[] });
  write(row: Record<string, unknown>): void;
  writeMany(rows: Record<string, unknown>[]): void;
  count(): number;
  close(): Promise<void>;
}

export interface DistributedAdapter {
  enqueue(items: unknown[]): Promise<void>;
  dequeue(): Promise<unknown | null>;
  complete(item: unknown): Promise<void>;
  release(item: unknown): Promise<void>;
  size(): Promise<Record<string, number>>;
}

export class MemoryAdapter implements DistributedAdapter {
  enqueue(items: unknown[]): Promise<void>;
  dequeue(): Promise<unknown | null>;
  complete(item: unknown): Promise<void>;
  release(item: unknown): Promise<void>;
  size(): Promise<{ queued: number; locked: number; done: number }>;
}

export interface DistributedQueueResult<T = unknown> {
  item: unknown;
  result: T | null;
  error: Error | null;
  droppedAfterRetries?: number;
}

export class DistributedQueue {
  constructor(options?: { adapter?: DistributedAdapter; workerId?: string; pollInterval?: number; emptyRetries?: number; maxItemRetries?: number });
  enqueue(items: unknown | unknown[]): Promise<void>;
  run<T = unknown>(visitFn: (item: unknown, workerId: string) => Promise<T>, options?: { concurrency?: number }): Promise<DistributedQueueResult<T>[]>;
  size(): Promise<Record<string, number>>;
}

export class Ryna {
  constructor(options?: RynaOptions);

  fingerprint: Fingerprint;
  cookieJar: CookieJar | null;
  interceptors: Interceptors;
  plugins: PluginSystem;
  pluginSystem: PluginSystem;
  cache: Cache | null;
  rateLimiter: RateLimiter;
  proxyRotator: ProxyRotator;
  security: SecurityGuard;
  securityGuard: SecurityGuard;
  circuitBreaker: CircuitBreaker | null;
  incremental: Incremental | null;
  csrf: CsrfHandler;
  csrfHandler: CsrfHandler;
  auth: AuthManager;
  authManager: AuthManager;
  sessionPool: SessionPool;
  observability: Observability;
  dnsCache: DnsCache | null;
  formHandler: FormHandler;
  deduplicator: unknown;
  health: HealthMonitor | null;
  healthMonitor: HealthMonitor | null;
  diff: DiffDetector | null;
  diffDetector: DiffDetector | null;
  validator: SchemaValidator | null;
  wordpress: WordPress;
  graphql: GraphQLClient;

  fetch(url: string, options?: { params?: Record<string, unknown>; request?: RequestConfig }): Promise<RawResponse>;
  load(html: string): CheerioAPI;

  extract<T = Record<string, unknown>>(url: string, schema: Schema<T>, options?: ExtractOptions): Promise<ExtractResult<T>>;
  batch<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): Promise<BatchResult<T>[]>;
  stream<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): AsyncGenerator<BatchResult<T>>;
  paginate<T = Record<string, unknown>>(startUrl: string, config: PaginationConfig, schema: Schema<T>, options?: ExtractOptions): Promise<T[]>;
  crawl(options: CrawlOptions): CrawlJob;

  login(url: string, formData?: Record<string, unknown>, options?: { headers?: Record<string, string> }): Promise<boolean>;
  submitForm(url: string, formSelector: string, overrides?: Record<string, unknown>): Promise<{ status: number; headers: Record<string, unknown>; body: string; url: string }>;
  discover(origin: string, options?: { maxDepth?: number; maxEntries?: number; pattern?: RegExp }): Promise<string[]>;
  isAllowed(url: string, userAgent?: string): Promise<boolean>;
  getCrawlDelay(origin: string, userAgent?: string): Promise<number | null>;
  export(input: string | string[] | unknown, schema?: Record<string, SchemaField>, options?: Record<string, unknown>): Promise<string>;

  inferSchema(url: string, options?: { hints?: string[]; list?: boolean }): Promise<SchemaInferenceResult>;
  distributedQueue(options?: ConstructorParameters<typeof DistributedQueue>[0]): DistributedQueue;

  extractJsonLd(url: string): Promise<Record<string, unknown>[]>;
  extractMicrodata(url: string): Promise<Record<string, unknown>[]>;
  extractDataAttributes(url: string, selector: string): Promise<Record<string, unknown>[]>;
  extractScripts(url: string): Promise<Array<{ inline: boolean; src: string | null; type: string; content: string | null }>>;

  getObservabilityReport(): ObservabilityReport;
  saveHar(filePath: string): void;
}

export interface SengkrepStatic {
  <T = Record<string, unknown>>(url: string, schema: Schema<T>, options?: ExtractOptions): Promise<ExtractResult<T>>;

  create(options?: RynaOptions): Ryna;
  fetch(url: string, options?: { params?: Record<string, unknown>; request?: RequestConfig }): Promise<RawResponse>;
  load(html: string): CheerioAPI;
  extract<T = Record<string, unknown>>(url: string, schema: Schema<T>, options?: ExtractOptions): Promise<ExtractResult<T>>;
  batch<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): Promise<BatchResult<T>[]>;
  stream<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): AsyncGenerator<BatchResult<T>>;
  paginate<T = Record<string, unknown>>(startUrl: string, config: PaginationConfig, schema: Schema<T>, options?: ExtractOptions): Promise<T[]>;
  login(url: string, formData?: Record<string, unknown>, options?: Record<string, unknown>): Promise<boolean>;
  discover(origin: string, options?: Record<string, unknown>): Promise<string[]>;
  isAllowed(url: string, userAgent?: string): Promise<boolean>;
  getCrawlDelay(origin: string, userAgent?: string): Promise<number | null>;
  export(input: string | string[] | unknown, schema?: Record<string, SchemaField>, options?: Record<string, unknown>): Promise<string>;
  crawl(options: CrawlOptions): CrawlJob;
  submitForm(url: string, formSelector: string, overrides?: Record<string, unknown>): Promise<unknown>;
  inferSchema(url: string, options?: Record<string, unknown>): Promise<SchemaInferenceResult>;

  Ryna: typeof Ryna;
  Fingerprint: typeof Fingerprint;
  HealthMonitor: typeof HealthMonitor;
  DiffDetector: typeof DiffDetector;
  SchemaValidator: typeof SchemaValidator;
  Cache: typeof Cache;
  CookieJar: typeof CookieJar;
  RateLimiter: typeof RateLimiter;
  ProxyRotator: typeof ProxyRotator;
  Interceptors: typeof Interceptors;
  Webhook: typeof Webhook;
  Discover: typeof Discover;
  SecurityGuard: typeof SecurityGuard;
  CircuitBreaker: typeof CircuitBreaker;
  Incremental: typeof Incremental;
  CsrfHandler: typeof CsrfHandler;
  AuthManager: typeof AuthManager;
  SessionPool: typeof SessionPool;
  PluginSystem: typeof PluginSystem;
  CrawlQueue: typeof CrawlQueue;
  Observability: typeof Observability;
  HarRecorder: typeof HarRecorder;
  WordPress: typeof WordPress;
  GraphQLClient: typeof GraphQLClient;
  DnsCache: typeof DnsCache;
  FormHandler: typeof FormHandler;
  ProgressBar: typeof ProgressBar;
  PaginationDetector: unknown;
  DistributedQueue: typeof DistributedQueue;
  MemoryAdapter: typeof MemoryAdapter;
  StreamWriter: typeof StreamWriter;

  cheerio: { load: (html: string) => CheerioAPI };
  plugins: {
    timestamp: (fieldName?: string) => PluginHooks;
    logToFile: (filePath: string) => PluginHooks;
    fieldMapper: (mapping: Record<string, string>) => PluginHooks;
  };

  exportData(data: unknown, options?: { format?: string; path?: string }): string;
  toCSV(data: unknown[]): string;
  toJSON(data: unknown): string;
  toNDJSON(data: unknown[]): string;
  toMarkdownTable(data: unknown[]): string;
  parseFeed(xml: string): { type: 'rss' | 'atom' | 'unknown'; title: string | null; items: unknown[] };
  parseCSV(text: string): Record<string, string>[];
  extractJsonLd($: CheerioAPI): Record<string, unknown>[];
  extractMicrodata($: CheerioAPI): Record<string, unknown>[];
  extractDataAttributes($: CheerioAPI, selector: string): Record<string, unknown>[];
  extractScripts($: CheerioAPI, baseUrl: string): Array<{ inline: boolean; src: string | null; type: string; content: string | null }>;
  extractSourceMapUrl(jsText: string): string | null;
  beautifyJs(jsText: string, indentSize?: number): string;
  normalizeUrl(url: string, options?: Record<string, unknown>): string;
  extractLinks($: CheerioAPI, baseUrl: string, options?: Record<string, unknown>): string[];
  contentSafety: {
    sniffContentType(buffer: Buffer): string | null;
    isLikelyBinary(buffer: Buffer): boolean;
    decodeBuffer(buffer: Buffer, options?: { headerCharset?: string | null }): { text: string; charset: string; source: string };
    inspect(buffer: Buffer, contentType?: string | null): { isBinary: boolean; sniffedType: string | null; declaredType: string | null; mismatch: boolean; size: number };
  };

  decodeHtmlEntities(text: string): string;
  decodeUnicodeEscapes(text: string): string;
  decodeBase64(str: string): string;
  decodeHex(str: string): string;
  detectAndDecode(str: string): { encoding: 'base64' | 'hex' | null; decoded: string };
  xorDecode(str: string | Buffer, key: string): Buffer;
  caesarDecode(str: string, shift: number): string;
  rot13(str: string): string;
  parseJSONP(text: string): { callback: string; data: unknown } | null;

  errors: {
    FetchError: typeof FetchError;
    TimeoutError: typeof TimeoutError;
    CanceledError: typeof CanceledError;
    ProxyError: typeof ProxyError;
    ExtractionError: typeof ExtractionError;
    JsonExtractionError: typeof JsonExtractionError;
    ValidationError: typeof ValidationError;
    SecurityError: typeof SecurityError;
    CircuitOpenError: typeof CircuitOpenError;
  };
}

declare const sengkrep: SengkrepStatic;
export default sengkrep;
