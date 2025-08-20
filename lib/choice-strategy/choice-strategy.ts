/**
 * Strategy of choosing one element of many.
 * It helps {@link LookupController} to choose one address of a list.
 *
 * @group ChoiceStrategy
 * @example
 * import { ChoiceStrategy, EmptyArrayError, LookupController } from 'super-dns-lookup';
 *
 * export class ChoiceStrategyExample implements ChoiceStrategy {
 *   public chooseOne<Element>(array: Element[]): Element {
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
  chooseOne<Element extends object>(array: Element[]): Element;
}
