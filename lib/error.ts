/**
 * Basic (abstract) error class.
 * It is meant to be a basic error class for any kind of error library components throw.
 * It also meant to be a basic class for any kind of error thrown by user-implemented services or strategies used during lookup.
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
 *       throw new SomethingBadError();
 *     }
 *   }
 *   public write(data: Data): Promise<void>;
 * }
 */
export abstract class SuperDnsLookupError extends Error {}
