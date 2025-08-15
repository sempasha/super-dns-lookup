import { SuperDnsLookupError } from './error';

/**
 * Strategy of choosing one element of many.
 * It helps LookupController to choose one address of a list.
 *
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
   * Should choose only one element of an array of elements.
   * Should throw an EmptyArrayError when array is empty, LookupController guarantee that array always have at least one element.
   *
   * @param array
   * @return One of array elements
   */
  chooseOne<T extends object>(array: T[]): T;
}

/**
 * Error should be used by ChoiceStrategy when empty array passed to ChoiceStrategy#chooseOne
 *
 * @example
 * const emptyArray = [];
 * if (emptyArray) {
 *   throw new EmptyArrayError(emptyArray);
 * }
 */
export class EmptyArrayError extends SuperDnsLookupError {
  public constructor(public readonly emptyArray: unknown[]) {
    super('Array must have at least one element, ' + 'see EmptyArrayError#emptyArray for more details');
  }
}

/**
 * Round-Robin implementation of ChoiceStrategy.
 *
 * @example
 * import { LookupController, RoundRobinChoiceStrategy } from 'super-dns-lookup';
 *
 * const choiceStrategy = new RoundRobinChoiceStrategy();
 * const lookupController = new LookupController({ choiceStrategy });
 */
export class RoundRobinChoiceStrategy {
  protected choices = new WeakMap<unknown[], { index: number }>();

  /**
   * Should return first array element when called first time with specified array.
   * Should return next array element on each subsequent call.
   * Should restart cycle when last array element is reached and return first element again, and next on subsequent call.
   * Should restart cycle when array has been shrunk since last call and return first element again, and next on subsequent call.
   * Should throw an EmptyArrayError when array has no elements at all.
   *
   * @param array
   * @returns Chosen array element.
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
