import { SuperDnsLookupError } from './error';

/**
 * The error {@link ChoiceStrategy} implementation should use when empty array passed to {@link ChoiceStrategy#chooseOne}.
 *
 * @group ChoiceStrategy
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

/**
 * Strategy of choosing one element of many.
 * It helps {@link LookupController} to choose one address of a list.
 *
 * @group ChoiceStrategy
 * @example
 * import { ChoiceStrategy, EmptyArrayError, LookupController } from 'super-dns-lookup';
 *
 * export class ChoiceStrategyExample implements ChoiceStrategy {
 *   public chooseOne<T>(array: T[]): T {
 *     if (array.length < 1) {
 *       throw new EmptyArrayError(array);
 *     }
 *     return array[0]!;
 *   }
 * }
 */
export interface ChoiceStrategy {
  /**
   * Selects the single element of entire list of elements.
   * Throws an {@link EmptyArrayError} when array is empty, {@link LookupController} guarantees that array always have at least one element.
   *
   * @param array An array of elements from which the one must be selected.
   * @returns The chosen one element of an array.
   * @throws {@link EmptyArrayError} when array is empty.
   */
  chooseOne<T extends object>(array: T[]): T;
}

/**
 * Round-Robin implementation of {@link ChoiceStrategy}.
 *
 * @group ChoiceStrategy
 * @example
 * import { LookupController, RoundRobinChoiceStrategy } from 'super-dns-lookup';
 *
 * const choiceStrategy = new RoundRobinChoiceStrategy();
 * const lookupController = new LookupController({ choiceStrategy });
 */
export class RoundRobinChoiceStrategy {
  protected choices = new WeakMap<unknown[], { index: number }>();

  /**
   * Returns first array element when called first time with specified array.
   * Returns next array element on each subsequent call.
   * Returns first element again when last array element has been reached on previous call, completing the round this way.
   * Repeat iterations round by round again and again.
   * Throws an {@link EmptyArrayError} when array has no elements at all.
   *
   * @param array An array of elements from which the one must be selected.
   * @returns The chosen one element of an array.
   * @throws {@link EmptyArrayError} when array is empty.
   */
  public chooseOne<T extends object>(array: T[]): T {
    if (array.length === 0) {
      throw new EmptyArrayError(array);
    }

    const choice = this.choices.get(array);

    if (!choice) {
      this.choices.set(array, { index: 0 });
      return array[0]!;
    }

    if (++choice.index < array.length) {
      return array[choice.index]!;
    }

    choice.index = 0;
    return array[0]!;
  }
}
