import { LRUCache } from 'lru-cache';
import { CacheService } from './cache-service';

/**
 * Options for the LRU (Least Recently Used) cache.
 *
 * @group CacheService
 * @example
 * import { LRUCacheService, LRUCacheServiceOptions } from 'super-dns-lookup';
 *
 * const options: LRUCacheServiceOptions = { maxHostnames: 1000 };
 * const cacheService = new LRUCacheService(options);
 */
export interface LRUCacheServiceOptions {
  /**
   * Sets the maximum number of resolution results that can be stored in the cache.
   * To estimate memory usage, assume that each cache record for a single hostname requires 500 bytes.
   *
   * @default 1000
   */
  maxHostnames?: number;
}

/**
 * {@link CacheService} implementation based on [LRU cache](https://isaacs.github.io/node-lru-cache/).
 *
 * @group CacheService
 * @example
 * const cacheService = new LRUCacheService({ maxHostnames: 1000 });
 * const lookupController = new LookupController({ cacheService });
 */
export class LRUCacheService<Value extends unknown = unknown> implements CacheService<Value> {
  /**
   * LRUCache instance
   */
  protected lru: LRUCache<string, any>;

  /**
   * Creates cache service using {@link LRUCache}.
   * Set {@link LRUCache} size as option {@link LRUCacheServiceOptions#maxHostnames} said.
   *
   * @example
   * import { LRUCacheService } from 'super-dns-lookup';
   *
   * const smallCache = new LRUCacheService({ maxHostnames: 1000 });
   * const largeCache = new LRUCacheService({ maxHostnames: 1000000 });
   * @param options Options of LRU cache.
   */
  public constructor({ maxHostnames = 1000 }: LRUCacheServiceOptions = {}) {
    this.lru = new LRUCache({ max: maxHostnames });
  }

  /**
   * Provides iterable object which give an ability to iterate over `[key, value]` pairs stored in cache.
   * Acts same way as LRUCache#entries.
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
  public entries(): Iterable<[key: string, value: Value]> {
    return this.lru.entries();
  }

  /**
   * Returns the value associated with the given key.
   * Returns undefined when no value found associated with given key.
   * A value may not be found for one of the following reasons:
   *
   * 1. It has never been stored with {@link CacheService#set}.
   * 2. It has been evicted from storage due to lack of space or other reasons. Cache memory management behavior may vary.
   *
   * Acts same way as LRUCache#get.
   *
   * @example
   * import { strictEqual } from 'node:assert';
   * import { LRUCacheService } from 'super-dns-lookup';
   *
   * const cacheService = new LRUCacheService();
   * cacheService.set('known key', 'known value');
   * strictEqual(cacheService.get('known key'), 'known value');
   * strictEqual(typeof cacheService.get('unknown key'), 'undefined');
   * @param key The key associated with the value during the {@link CacheService#set} call.
   * @returns The stored value associated with the given key or `undefined` when nothing found.
   */
  public get(key: string): Value | undefined {
    return this.lru.get(key);
  }

  /**
   * Stores a value associated with the given key string.
   * Overrides the previously stored value with the new one if the key already has an associated value in the cache.
   * Acts same way as LRUCache#set.
   *
   * @example
   * import { strictEqual } from 'node:assert';
   * import { LRUCacheService } from 'super-dns-lookup';
   *
   * const cacheService = new LRUCacheService();
   * cacheService.set('known key', 'known value');
   * strictEqual(cacheService.get('known key'), 'known value');
   * strictEqual(typeof cacheService.get('unknown key'), 'undefined');
   * @param key The key to which the value will be associated.
   * @param value The value to be stored.
   * @returns This function does not return anything.
   */
  public set(key: string, value: Value): void {
    this.lru.set(key, value);
  }
}
