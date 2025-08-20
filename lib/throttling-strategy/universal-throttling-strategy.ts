import { Resolve, ThrottlingStrategy } from './throttling-strategy';

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
  /**
   * TODO: describe behavior
   */
  public throttleResolve(resolve: Resolve): Resolve {
    throw new Error('Method not implemented.');
  }
}
