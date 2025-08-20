import { SuperDnsLookupError } from '../error';

/**
 * The error {@link ChoiceStrategy} implementation should use when empty array passed to {@link ChoiceStrategy#chooseOne}.
 *
 * @group ChoiceStrategy
 * @group Errors
 * @example
 * const emptyArray = [];
 * if (emptyArray) {
 *   throw new EmptyArrayError(emptyArray);
 * }
 */
export class EmptyArrayError extends SuperDnsLookupError {
  /**
   * Creates an instance of {@link EmptyArrayError} with given empty array.
   * @param emptyArray An empty array, user want to use this array for debug purpose.
   */
  public constructor(public readonly emptyArray: unknown[]) {
    super('Array must have at least one element, ' + 'see EmptyArrayError#emptyArray for more details');
  }
}
