import { LRUCache } from 'lru-cache';

/**
 * CacheService is a simple synchronous in-memory storage.
 * LookupController uses it to store hostname resolution results.
 *
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
   * Should return the value associated with the given key.
   * Should return undefined when no value found associated with given key.
   * A value may not be found for one of the following reasons:
   *
   * 1. It has never been stored.
   * 2. It has been evicted from storage due to lack of space or other reasons; cache behavior may vary.
   *
   * @example
   * import { strictEqual } from 'node:assert';
   * import { CacheServiceExample } from './cache-service-example';
   *
   * const cacheService = new CacheServiceExample();
   * cacheService.set('known key', 'known value');
   * strictEqual(cacheService.get('known key'), 'known value');
   * strictEqual(typeof cacheService.get('unknown key'), 'undefined');
   * @param key The key associated with the value during the CacheService#set call.
   * @returns The stored value associated with the given key or `undefined` when nothing found.
   */
  get(key: string): Value | undefined;

  /**
   * Should store a value associated with the given key string.
   * Should override the previously stored value with the new one if the key already has an associated value in the cache.
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
   * @returns This function does not return anything.
   */
  set(key: string, value: Value): void;
}

/**
 * Options for the LRU (Least Recently Used) cache.
 *
 * @example
 * import { LRUCacheService, LRUCacheServiceOptions } from 'super-dns-lookup';
 *
 * const options: LRUCacheServiceOptions = { maxHostnames: 1000 };
 * const cacheService = new LRUCacheService(options);
 */
export type LRUCacheServiceOptions = {
  /**
   * The maximum number of resolution results that can be stored in the cache.
   * To estimate memory usage, assume that each cache record for a single hostname requires 500 bytes.
   *
   * @default 1000
   */
  maxHostnames?: number;
};

/**
 * Implementation of CacheService using LRU (Least Recently Used) caching.
 *
 * @example
 * const cacheService = new LRUCacheService({ maxHostnames: 1000 });
 * const lookupController = new LookupController({ cacheService });
 */
export class LRUCacheService<Value extends unknown = unknown>
  extends LRUCache<string, any>
  implements CacheService<Value>
{
  /**
   * Should create service with specified options (LRUCacheServiceOptions).
   *
   * @example
   * import { LRUCacheService } from 'super-dns-lookup';
   *
   * const smallCache = new LRUCacheService({ maxHostnames: 1000 });
   * const largeCache = new LRUCacheService({ maxHostnames: 1000000 });
   * @param options Options of LRU cache ()
   */
  public constructor({ maxHostnames = 1000 }: LRUCacheServiceOptions = {}) {
    super({ max: maxHostnames });
  }
}
