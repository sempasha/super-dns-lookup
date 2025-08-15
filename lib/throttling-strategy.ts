/**
 * Allows {@link LookupController} to avoid excessive calls of {@link ResolverService#resolve4} and {@link ResolverService#resolve6} by providing interface to make a throttled version of resolution function.
 *
 * @group ThrottlingStrategy
 * @example
 * import pThrottle from 'p-throttleResolve';
 * import { ThrottlingStrategy } from 'super-dns-lookup';
 *
 * export class ResolverThrottlingStrategyExample implements ThrottlingStrategy {
 *   public throttleResolve: T extends (...args: any[]) => any>(f: T) => T;
 *
 *   public constructor() {
 *     this.throttleResolve = pThrottle({ limit Infinity, interval: 1000 });
 *   }
 *
 *   public throttleResolve<T extends (...args: any[]) => any>(resolve: T) {
 *     return this.throttleResolve(resolve);
 *   }
 * }
 */
export interface ThrottlingStrategy {
  throttleResolve<T extends (...args: any[]) => any>(resolve: T): T;
}

/**
 * Default resolver throttling strategy for {@link LookupController}.
 *
 * @group ThrottlingStrategy
 * @example
 * import { LookupController, UniversalThrottlingStrategy } from 'super-dns-lookup';
 *
 * const throttlingStrategy = new UniversalThrottlingStrategy();
 * const lookupController = new LookupController({ throttlingStrategy });
 */
export class UniversalThrottlingStrategy implements ThrottlingStrategy {
  public throttleResolve<T extends (...args: any[]) => any>(resolve: T): T {
    throw new Error('Method not implemented.');
  }
}
