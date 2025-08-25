import { type ResolverService } from '../resolver-service';

/**
 * Allows {@link LookupController} to avoid excessive calls of {@link ResolverService#resolve4} and {@link ResolverService#resolve6} by providing interface to make a throttled version of resolution function.
 *
 * @group ThrottlingStrategy
 * @example
 * import throttle from 'lodash.throttle';
 * import { type ThrottlingStrategy } from 'super-dns-lookup';
 *
 * export class ThrottlingStrategyExample implements ThrottlingStrategy {
 *   public throttle<Result>(originalFunction: () => Result): () => Result {
 *     return throttle(originalFunction, 1000, { leading: true, trailing: false });
 *   }
 * }
 */
export interface ThrottlingStrategy {
  /**
   * Creates throttled version of function.
   * When called for first time, throttled function executes original function and return original function  execution result.
   * When called next time, throttled function may skip original function execution and return last original function execution result.
   * Never calls original function after throttled function completion.
   *
   * @example
   * import { fetchUrl } from './fetch-url';
   * import { ThrottlingStrategyExample } from './throttling-strategy-example';
   *
   * const throttlingStrategy = new ThrottlingStrategyExample();
   * const originalFunction = () => fetchDataFromService({
   *   url: 'https://example.com/some.data'
   * });
   * const throttledFunction = throttlingStrategy.throttle(originalFunction);
   *
   * @param originalFunction Function which required to be throttled. Function must have no args.
   */
  throttle<Result>(originalFunction: () => Result): () => Result;
}
