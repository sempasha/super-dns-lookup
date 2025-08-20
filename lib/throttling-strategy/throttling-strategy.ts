import { ResolverService } from '../resolver-service';

export type Resolve = ResolverService['resolve4'] | ResolverService['resolve6'];

/**
 * Allows {@link LookupController} to avoid excessive calls of {@link ResolverService#resolve4} and {@link ResolverService#resolve6} by providing interface to make a throttled version of resolution function.
 *
 * @group ThrottlingStrategy
 * @example
 * import pThrottle from 'p-throttleResolve';
 * import { ThrottlingStrategy } from 'super-dns-lookup';
 *
 * export class ThrottlingStrategyExample implements ThrottlingStrategy {
 *   public throttle: Resolve extends (...args: any[]) => any>(f: Resolve) => Resolve;
 *
 *   public constructor() {
 *     this.throttle = pThrottle({ limit Infinity, interval: 1000 });
 *   }
 *
 *   public throttleResolve<Resolve extends (...args: any[]) => any>(resolve: Resolve) {
 *     return this.throttle(resolve);
 *   }
 * }
 */
export interface ThrottlingStrategy {
  /**
   * TODO: describe behavior
   */
  throttleResolve(resolve: Resolve): Resolve;
}
