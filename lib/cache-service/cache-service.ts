/**
 * {@link CacheService} is a simple synchronous in-memory storage.
 * {@link LookupController} uses it to store hostname resolution results.
 *
 * @group CacheService
 * @example
 * import { CacheService, LookupController } from 'super-dns-lookup';
 *
 * export class CacheServiceExample<Value = unknown> implements CacheService<Value> {
 *   protected storage: Record<string, Value> = {};
 *
 *   public get(key: string): Value | undefined {
 *     return this.storage[key];
 *   }
 *
 *   public set(key: string, value: Value): void {
 *     this.storage[key] = value;
 *   }
 * }
 */
export interface CacheService<Value extends unknown = unknown> {
  /**
   * Provides iterable object which give an ability to iterate over `[key, value]` pairs stored in cache.
   * Acts same way as {@link Map#entries}.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { CacheServiceExample } from './cache-service-example';
   *
   * const cacheService = new CacheServiceExample();
   * cacheService.set('key 1', 'value 1');
   * cacheService.set('key 2', 'value 2');
   * for (const [key, value] of cacheService.entries()) {
   *   equal(key.slice(0, -1), 'key ');
   *   equal(value.slice(0, -1), 'value ');
   *   equal(key.slice(-1), value.slice(-1));
   * }
   * @returns Iterable object which has an iterator over `[key, value]` pairs stored in cache.
   */
  entries(): Iterable<[key: string, value: Value]>;

  /**
   * Returns the value associated with the given key.
   * Or returns `undefined` when no value found associated with given key.
   * A value may not be found for one of the following reasons:
   *
   * 1. It has never been stored with {@link CacheService#set}.
   * 2. It has been evicted from storage due to lack of space or other reasons. Cache memory management behavior may vary.
   *
   * Acts same way as LRUCache#get.
   *
   * @example
   * import { strictEqual } from 'node:assert';
   * import { CacheServiceExample } from './cache-service-example';
   *
   * const cacheService = new CacheServiceExample();
   * cacheService.set('known key', 'known value');
   * strictEqual(cacheService.get('known key'), 'known value');
   * strictEqual(typeof cacheService.get('unknown key'), 'undefined');
   * @param key The key associated with the value during the {@link CacheService#set} call.
   * @returns The stored value associated with the given key or `undefined` when nothing found.
   */
  get(key: string): Value | undefined;

  /**
   * Stores a value associated with the given key string.
   * Overrides the previously stored value with the new one if the key already has an associated value in the cache.
   * Acts same way as LRUCache#set.
   *
   * @example
   * import { strictEqual } from 'node:assert';
   * import { CacheServiceExample } from './cache-service-example';
   *
   * const cacheService = new CacheService();
   * cacheService.set('known key', 'known value');
   * strictEqual(cacheService.get('known key'), 'known value');
   * strictEqual(typeof cacheService.get('unknown key'), 'undefined');
   * @param key The key to which the value will be associated.
   * @param value The value to be stored.
   * @returns Nothing.
   */
  set(key: string, value: Value): void;
}
