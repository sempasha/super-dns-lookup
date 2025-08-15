/**
 * Basic (abstract) error class.
 * Has a goal - to be a basic error class for any kind of error library components throw.
 * Also has a goal to be basic class for any kind or error thrown by user implemented service or strategy used during lookup.
 *
 * @group Errors
 * @example
 * import { SuperDnsLookupError, PersistentStorageService } from 'super-dns-lookup';
 *
 * // First: we create real world error class.
 * export class SomethingBadError extends SuperDnsLookupError {
 *   public constructor() {
 *     super('Something is bad!');
 *   }
 * }
 *
 * // Second: we use our error class to express some error occurrence.
 * export class PersistentStorageService<Data> implements ChoiceStrategy {
 *   public read() {
 *     if (somethingBad) {
 *       throw new SuperDnsLookupError();
 *     }
 *   }
 *   public write(data: Data): Promise<void>;
 * }
 */
export abstract class SuperDnsLookupError extends Error {}
