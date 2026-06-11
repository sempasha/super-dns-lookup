import throttle from 'lodash.throttle';
import { type ThrottlingStrategy } from './throttling-strategy';

/**
 * {@link UniversalThrottlingStrategy} options
 */
export type UniversalThrottlingStrategyOptions = {
  /**
   * Throttling time.
   * Original function will be called at most once during this period of time.
   *
   * @group ThrottlingStrategy
   * @default 1000
   */
  intervalMs?: number;
};

/**
 * Default resolver throttling strategy for {@link LookupController}.
 *
 * @group ThrottlingStrategy
 * @example
 * import { SuperLookupController, UniversalThrottlingStrategy } from 'super-dns-lookup';
 *
 * const throttlingStrategy = new UniversalThrottlingStrategy();
 * const lookupController = new SuperLookupController({ throttlingStrategy });
 */
export class UniversalThrottlingStrategy implements ThrottlingStrategy {
  /**
   * Throttling time.
   */
  protected readonly intervalMs: number;

  /**
   * Creates universal throttling strategy.
   *
   * @example
   * import { SuperLookupController, UniversalThrottlingStrategy } from 'super-dns-lookup';
   *
   * const shortThrottlingStrategy = new UniversalThrottlingStrategy({ intervalMs: 100 });
   * const longThrottlingStrategy = new UniversalThrottlingStrategy({ intervalMs: 5000 });
   * @param options Throttling strategy options.
   */
  public constructor({ intervalMs = 1000 }: UniversalThrottlingStrategyOptions = {}) {
    this.intervalMs = intervalMs;
  }

  /**
   * Creates throttled version of function.
   * When called for first time, throttled function will execute original function and return original function execution result.
   * When called later then {@link UniversalThrottlingStrategyOptions#intervalMs} since last original function execution, throttled function will execute original function again and return new original function execution result.
   * When called less then {@link UniversalThrottlingStrategyOptions#intervalMs} since last original function execution, throttled function will skip original function execution and return latest original function execution result.
   * Never calls original function after throttled function completion (i.e. no trailing call after {@link UniversalThrottlingStrategyOptions#intervalMs}).
   */
  public throttle<Result>(originalFunction: () => Result): () => Result {
    return throttle(originalFunction, this.intervalMs, { leading: true, trailing: false });
  }
}
