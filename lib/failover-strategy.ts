import { CONNREFUSED, NOTFOUND, REFUSED, SERVFAIL, TIMEOUT } from 'node:dns';

/**
 * FailoverStrategy helps {@link LookupController} to survive against {@link ResolverService} failures. When {@link ResolverService#resolve4} or {@link ResolverService#resolve6} is rejected with error, {@link LookupController} asks this strategy, how to react on occurred error, may controller use expired cache or even should controller cache the error for some time.
 *
 * @group FailoverStrategy
 * @example
 * import { FailoverStrategy } from 'super-dns-lookup';
 *
 * export class NoFailoverStrategy implements FailoverStrategy {
 *   public cacheResolverFailure() {
 *     // do not cache any of error
 *     return false;
 *   }
 *
 *   public useExpiredCache() {
 *     // never use expired cache
 *     return false;
 *   }
 * }
 *
 * export class SurvivalFailoverStrategy implements FailoverStrategy {
 *   public cacheResolverFailure() {
 *     // cache failures for 1 second
 *     // to avoid pressure on resolver service
 *     return { ttlMs: 1000 };
 *   }
 *
 *   public useExpiredCache() {
 *     // use cache expired then one hour ago
 *     return { maxExpirationMs: 3600_000 };
 *   }
 * }
 */
export interface FailoverStrategy {
  /**
   * Tells to {@link LookupController} what to do with {@link ResolverService} errors.
   * Method should make a decision looking on given resolution `error` and `hostname`.
   * Should return `false`, when {@link LookupController} should not cache error.
   * Or should return object with `ttlMs` property when strategy wants {@link LookupController} to cache failure on specified number of milliseconds.
   *
   * @param error Resolution error.
   * @param hostname Hostname of failed resolve request.
   * @returns Behavior instruction where `false` means not to cache error and object with `ttlMs` means to store error in cache with given ttl.
   */
  cacheResolverFailure(error: unknown, hostname: string): false | { ttlMs: number };

  /**
   * Tells to {@link LookupController} should is use expired cache in lookup request's reply or not.
   * Method should make a decision looking on given resolution `error` and `hostname`.
   * Should return `false`, when {@link LookupController} not allowed to use expired cache.
   * Or should return an object with `maxExpirationMs` property when strategy wants {@link LookupController} to use expired cache but expired less then `maxExpirationMs` milliseconds ago.
   *
   * @param error Resolution error.
   * @param hostname Hostname of failed resolve request.
   * @returns Behavior instruction where `false` means not to use expired cache error and object with `maxExpirationMs` means to use cache which expired less then given time ago.
   */
  useExpiredCache(error: unknown, hostname: string): false | { maxExpirationMs: number };
}

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
