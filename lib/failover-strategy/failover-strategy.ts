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
