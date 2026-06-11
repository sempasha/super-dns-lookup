import {
  BADFAMILY,
  BADFLAGS,
  BADHINTS,
  BADNAME,
  BADQUERY,
  BADRESP,
  BADSTR,
  CANCELLED,
  CONNREFUSED,
  DESTRUCTION,
  FORMERR,
  NODATA,
  NOMEM,
  NONAME,
  NOTFOUND,
  NOTIMP,
  NOTINITIALIZED,
  REFUSED,
  SERVFAIL,
  TIMEOUT
} from 'node:dns';
import { LiteralUnion } from 'type-fest';
import { type FailoverStrategy } from './failover-strategy';

/**
 * This type represents all known DNS error codes combined with very basic error code type (string).
 */
export type DNSErrorCode = LiteralUnion<
  | typeof BADFAMILY
  | typeof BADFLAGS
  | typeof BADHINTS
  | typeof BADNAME
  | typeof BADQUERY
  | typeof BADRESP
  | typeof BADSTR
  | typeof CANCELLED
  | typeof CONNREFUSED
  | typeof DESTRUCTION
  | typeof FORMERR
  | typeof NODATA
  | typeof NOMEM
  | typeof NONAME
  | typeof NOTFOUND
  | typeof NOTIMP
  | typeof NOTINITIALIZED
  | typeof REFUSED
  | typeof SERVFAIL
  | typeof TIMEOUT,
  string
>;

/**
 * @group FailoverStrategy
 * @example
 * import { REFUSED } from 'node:dns';
 * import { UniversalFailoverStrategy, type UniversalFailoverStrategyOptions } from 'super-dns-lookup';
 *
 * const failoverStrategyOptions: UniversalFailoverStrategyOptions = {
 *   // cache only TIMEOUT errors
 *   cacheErrorCodes: [TIMEOUT],
 *   // cache REFUSED error for 10 seconds to reject all subsequent
 *   // resolution requests for next 10 seconds with TIMEOUT error
 *   cacheErrorTtlMs: 10_000,
 *   // use only cache expired less then 30 minutes ago
 *   cacheMaxExpirationMs: 30 * 60 * 1000,
 *   // use expired cache only on TIMEOUT errors
 *   useExpiredCacheOnErrorCodes: [TIMEOUT],
 * };
 * const failoverStrategy = new UniversalFailoverStrategy(failoverStrategyOptions);
 */
export interface UniversalFailoverStrategyOptions {
  /**
   * List of error codes when {@link LookupController} should cache error to reduce pressure on DNS resolver service.
   *
   * @default [dns.CONNREFUSED, dns.NOTFOUND, dns.REFUSED, dns.SERVFAIL, dns.TIMEOUT]
   */
  cacheErrorCodes?: DNSErrorCode[];

  /**
   * Time (ms) after resolution error has occurred when {@link LookupController} should use cached resolution error.
   *
   * @default 1000
   */
  cacheErrorTtlMs?: number;

  /**
   * Maximum cache expiration time (ms) when {@link LookupController} is allowed to use expired cache in reply to lookup request.
   *
   * @default 3600_0000
   */
  cacheMaxExpirationMs?: number;

  /**
   * List of error codes when {@link LookupController} is allowed to use expired cache in reply to lookup request.
   *
   * @default [dns.CONNREFUSED,dns.NOTFOUND,dns.REFUSED,dns.SERVFAIL,dns.TIMEOUT]
   */
  useExpiredCacheOnErrorCodes?: DNSErrorCode[];
}

/**
 * This is default {@link FailoverStrategy}. It allows user to choose [error codes](https://nodejs.org/api/dns.html#error-codes) when {@link LookupController} should cache an error and choose the TTL for that cache. It also gives an ability to choose [error codes](https://nodejs.org/api/dns.html#error-codes) when {@link LookupController} is allowed to use expired cache and allows to set maximum expiration time of cache.
 *
 * @group FailoverStrategy
 * @example
 * import { TIMEOUT } from 'node:dns';
 * import { SuperLookupController, UniversalFailoverStrategy } from 'super-dns-lookup';
 *
 * const failoverStrategy = new UniversalFailoverStrategy({ cacheErrorCodes: [TIMEOUT] });
 * const lookupController = new SuperLookupController({ failoverStrategy });
 */
export class UniversalFailoverStrategy implements FailoverStrategy {
  protected readonly cacheErrorCodes: string[];
  protected readonly cacheErrorTtlMs: number;
  protected readonly cacheMaxExpirationMs: number;
  protected readonly useExpiredCacheOnErrorCodes: string[];

  /**
   * Creates universal failover strategy.
   *
   * @example
   * import { UniversalFailoverStrategy } from 'super-dns-lookup';
   *
   * const zeroTolerance = new UniversalFailoverStrategy({
   *   // never cache errors, next lookup request will end up to {@link ResolverService} again
   *   cacheErrorCodes: [],
   *   // never use expired cache, user will get all failed {@link ResolverService} requests
   *   useExpiredCacheOnErrorCodes: [],
   * });
   *
   * const totalAcceptance = new UniversalFailoverStrategy({
   *   // never cache errors, next lookup request will end up to {@link ResolverService} again
   *   cacheErrorCodes: [],
   *   // never use expired cache, user will get all failed {@link ResolverService} requests
   *   useExpiredCacheOnErrorCodes: [],
   * });
   * @param options Options of strategy.
   */
  public constructor({
    cacheErrorCodes = [CONNREFUSED, NOTFOUND, REFUSED, SERVFAIL, TIMEOUT],
    cacheErrorTtlMs = 1000,
    cacheMaxExpirationMs = 3600_000,
    useExpiredCacheOnErrorCodes = [CONNREFUSED, NOTFOUND, REFUSED, SERVFAIL, TIMEOUT]
  }: UniversalFailoverStrategyOptions = {}) {
    this.cacheErrorCodes = cacheErrorCodes;
    this.cacheErrorTtlMs = cacheErrorTtlMs;
    this.cacheMaxExpirationMs = cacheMaxExpirationMs;
    this.useExpiredCacheOnErrorCodes = useExpiredCacheOnErrorCodes;
  }

  /**
   * Tells not to cache any error when error not in {@link UniversalFailoverStrategyOptions#cacheErrorCodes} list.
   * Tells to cache only errors from {@link UniversalFailoverStrategyOptions#cacheErrorCodes} list.
   * Tells to cache these errors for {@link UniversalFailoverStrategyOptions#cacheErrorTtlMs} time.
   *
   * @param error Resolution error
   * @return Tells whether to cache error or not.
   */
  public cacheResolverFailure(error: unknown): false | { ttlMs: number } {
    const code = this.getErrorCode(error);
    if (code && this.cacheErrorCodes.includes(code)) {
      return { ttlMs: this.cacheErrorTtlMs };
    }
    return false;
  }

  /**
   * Forbid expired cache usage when error not in {@link UniversalFailoverStrategyOptions#cacheErrorCodes} list.
   * Allows expired cache usage only on errors from {@link UniversalFailoverStrategyOptions#useExpiredCacheOnErrorCodes} list.
   * Allows to use only cache expired less than {@link UniversalFailoverStrategyOptions#cacheMaxExpirationMs} ago.
   *
   * @param error Resolution error.
   * @returns Tells whether use expired cache record.
   */
  public useExpiredCache(error: unknown): false | { maxExpirationMs: number } {
    const code = this.getErrorCode(error);
    if (code && this.useExpiredCacheOnErrorCodes.includes(code)) {
      return { maxExpirationMs: this.cacheMaxExpirationMs };
    }
    return false;
  }

  /**
   * Extracts error code from error object.
   * @param error Error
   * @returns Error code
   */
  protected getErrorCode(error: unknown): string | undefined {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
      return error.code;
    }
    return undefined;
  }
}
