/**
 * Basic (abstract) error class.
 * Should be used as basic class for all errors of super-dns-lookup library.
 * Should be used by users as the basic class for all errors related to user-implemented services and strategies.
 *
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
