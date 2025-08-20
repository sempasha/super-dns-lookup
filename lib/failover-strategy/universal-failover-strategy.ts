import { CONNREFUSED, NOTFOUND, REFUSED, SERVFAIL, TIMEOUT } from 'node:dns';
import { FailoverStrategy } from './failover-strategy';

/**
 * @group FailoverStrategy
 * @example
 * import { REFUSED } from 'node:dns';
 * import { UniversalFailoverStrategy, UniversalFailoverStrategyOptions } from 'super-dns-lookup';
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
   * List of error codes when {@link LookupController} should cache error to reduce pressure on dns resolver service.
   *
   * @default [dns.CONNREFUSED,dns.NOTFOUND,dns.REFUSED,dns.SERVFAIL,dns.TIMEOUT]
   */
  cacheErrorCodes?: string[];

  /**
   * Time (ms) after resolution error has been occurred when {@link LookupController} should  use cached resolution error.
   *
   * @default 1000
   */
  cacheErrorTtlMs?: number;

  /**
   * Maximum cache expiration time (ms) when {@link LookupController} is allowed to use expired cache in reply of lookup request.
   *
   * @default 3600_0000
   */
  cacheMaxExpirationMs?: number;

  /**
   * List of error codes when {@link LookupController} is allowed to use expired cache in reply of lookup request.
   *
   * @default [dns.CONNREFUSED,dns.NOTFOUND,dns.REFUSED,dns.SERVFAIL,dns.TIMEOUT]
   */
  useExpiredCacheOnErrorCodes?: string[];
}

/**
 * This is default {@link FailoverStrategy}. It allows user to choose [error codes](https://nodejs.org/api/dns.html#error-codes) when {@link LookupController} should cache an error ans choose the TTL for that cache. It also give an ability to choose [error codes](https://nodejs.org/api/dns.html#error-codes) whe {@link LookupController} is allowed to use expired cache and allow to set maximum expiration time of cache.
 *
 * @group FailoverStrategy
 * @example
 * import { TIMEOUT } from 'node:dns';
 * import { LookupController, UniversalFailoverStrategy } from 'super-dns-lookup';
 *
 * const failoverStrategy = new UniversalFailoverStrategy({ cacheErrorCodes: [TIMEOUT] });
 * const lookupController = new LookupController({ failoverStrategy });
 */
export class UniversalFailoverStrategy implements FailoverStrategy {
  protected cacheErrorCodes: string[];
  protected cacheErrorTtlMs: number;
  protected cacheMaxExpirationMs: number;
  protected useExpiredCacheOnErrorCodes: string[];

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
   * Allows to use only cache expired less then {@link UniversalFailoverStrategyOptions#cacheMaxExpirationMs} ago.
   *
   * @param error Resolution error
   * @returns
   */
  public useExpiredCache(error: unknown): false | { maxExpirationMs: number } {
    const code = this.getErrorCode(error);
    if (code && this.useExpiredCacheOnErrorCodes.includes(code)) {
      return { maxExpirationMs: this.cacheMaxExpirationMs };
    }
    return false;
  }

  protected getErrorCode(error: unknown): string | undefined {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
      return error.code;
    }
    return undefined;
  }
}
