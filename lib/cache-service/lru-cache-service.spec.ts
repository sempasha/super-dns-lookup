import { deepEqual, equal, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { LRUCache } from 'lru-cache';
import { LRUCacheService } from './lru-cache-service';

describe('LRUCacheService', () => {
  // Class give an access to protected lru property of LRUCacheService
  class LRUCacheServiceForTest extends LRUCacheService {
    declare public lru: LRUCache<string, any>;
  }

  describe('#constructor', () => {
    it('Creates cache service using LRUCache.', () => {
      class LRUCacheServiceForTest extends LRUCacheService {
        declare public lru: LRUCache<string, any>;
      }
      const service = new LRUCacheServiceForTest();
      ok(service.lru instanceof LRUCache);
    });

    it('Set LRUCache size as option LRUCacheServiceOptions#maxHostnames said.', () => {
      const maxHostnames = 5000;
      const service = new LRUCacheServiceForTest({ maxHostnames });
      equal(service.lru.max, maxHostnames);
    });

    it('Has default cache size of 1000 records, when LRUCacheServiceOptions#maxHostnames not specified.', () => {
      const service = new LRUCacheServiceForTest();
      equal(service.lru.max, 1000);
    });
  });

  describe('#entries', () => {
    it('Provides iterable object which give an ability to iterate over `[key, value]` pairs stored in cache.', () => {
      const service = new LRUCacheServiceForTest();
      service.lru.set('key1', 'value1');
      service.lru.set('key2', 'value2');
      service.lru.set('key3', 'value3');
      const iterator = service.entries();
      ok(iterator[Symbol.iterator]);
      const array = Array.from(iterator);
      deepEqual(array, [
        // Due to LRUCache implementation, iterator provides access to
        // cache items in revers order, it does not matter for LookupController,
        // so we ignore this factor
        ['key3', 'value3'],
        ['key2', 'value2'],
        ['key1', 'value1']
      ]);
    });

    it('Acts same way as LRUCache#entries.', () => {
      const service = new LRUCacheServiceForTest();
      service.lru.set('key1', 'value1');
      service.lru.set('key2', 'value2');
      service.lru.set('key3', 'value3');
      deepEqual(Array.from(service.entries()), Array.from(service.lru.entries()));
    });
  });

  describe('#get', () => {
    it('Returns the value associated with the given key.', () => {
      const service = new LRUCacheServiceForTest();
      const key = 'key';
      const value = { property: 'value' };
      service.lru.set(key, value);
      strictEqual(service.get(key), value);
    });

    it('Returns undefined when no value found associated with given key.', () => {
      const service = new LRUCacheServiceForTest();
      strictEqual(service.get('unknown key'), undefined);
    });

    it('Acts same way as LRUCache#get.', () => {
      const service = new LRUCacheServiceForTest();
      const knownKey = 'known key';
      const knownValue = 'known value';
      const unknownKey = 'unknown key';
      service.lru.set(knownKey, knownValue);
      equal(service.get(knownKey), service.lru.get(knownKey));
      equal(service.get(unknownKey), service.lru.get(unknownKey));
    });
  });

  describe('#set', () => {
    it('Stores a value associated with the given key string.', () => {
      const service = new LRUCacheServiceForTest();
      const key = 'key';
      const value = { property: 'value' };
      service.set(key, value);
      strictEqual(service.lru.get(key), value);
    });

    it('Overrides the previously stored value with the new one if the key already has an associated value in the cache.', () => {
      const service = new LRUCacheServiceForTest();
      const key = 'key';
      const value = { property: 'value' };
      service.set(key, value);
      strictEqual(service.lru.get(key), value);
      const newValue = { property: 'new value' };
      service.set(key, newValue);
      strictEqual(service.lru.get(key), newValue);
    });

    it('Acts same way as LRUCache#set.', () => {
      const service1 = new LRUCacheServiceForTest();
      service1.set('key', 'value');
      equal(service1.lru.get('key'), 'value');

      const service2 = new LRUCacheServiceForTest();
      service2.lru.set('key', 'value');
      equal(service2.lru.get('key'), 'value');

      const service3 = new LRUCacheServiceForTest();
      service3.set('key', 'value');
      equal(service3.lru.get('key'), 'value');
      service3.set('key', 'new-value');
      equal(service3.lru.get('key'), 'new-value');

      const service4 = new LRUCacheServiceForTest();
      service4.lru.set('key', 'value');
      equal(service4.lru.get('key'), 'value');
      service4.lru.set('key', 'new-value');
      equal(service4.lru.get('key'), 'new-value');
    });
  });
});
