import { EmptyArrayError } from './empty-array-error';

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
  public chooseOne<Element extends object>(array: Element[]): Element {
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
