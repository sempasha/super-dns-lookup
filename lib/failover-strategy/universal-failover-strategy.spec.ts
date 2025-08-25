import { ok, strictEqual, deepEqual } from 'node:assert';
import {
  BADFAMILY,
  BADFLAGS,
  BADHINTS,
  BADNAME,
  BADQUERY,
  BADRESP,
  BADSTR,
  CANCELLED,
  CONNREFUSED,
  FORMERR,
  NODATA,
  NOMEM,
  NONAME,
  NOTFOUND,
  NOTIMP,
  NOTINITIALIZED,
  REFUSED,
  SERVFAIL,
  TIMEOUT
} from 'node:dns';
import { before, describe, it } from 'node:test';
import { UniversalFailoverStrategy } from './universal-failover-strategy';

function createError(code?: string): Error & { code?: string } {
  return Object.assign(new Error(), { code });
}

describe('UniversalFailoverStrategy', () => {
  describe('#cacheResolverFailure', () => {
    it('Tells not to cache any error when error not in UniversalFailoverStrategyOptions#cacheErrorCodes list.', () => {
      const strategy = new UniversalFailoverStrategy({ cacheErrorCodes: ['cache code'] });
      strictEqual(strategy.cacheResolverFailure(createError('do not cache this')), false);
      strictEqual(strategy.cacheResolverFailure(createError('do not cache that')), false);
    });

    it('Tells to cache only errors from UniversalFailoverStrategyOptions#cacheErrorCodes list.', () => {
      const cacheErrorCodes = ['cache this', 'cache that'];
      const strategy = new UniversalFailoverStrategy({ cacheErrorCodes });
      for (const code of cacheErrorCodes) {
        ok(strategy.cacheResolverFailure(createError(code)));
      }
    });

    it('By default UniversalFailoverStrategyOptions#cacheErrorCodes is [dns.CONNREFUSED,dns.NOTFOUND,dns.REFUSED,dns.SERVFAIL,dns.TIMEOUT]', () => {
      const cacheErrorCodes = [CONNREFUSED, NOTFOUND, REFUSED, SERVFAIL, TIMEOUT];
      const notCacheErrors = [
        BADFAMILY,
        BADFLAGS,
        BADHINTS,
        BADNAME,
        BADQUERY,
        BADRESP,
        BADSTR,
        CANCELLED,
        FORMERR,
        NODATA,
        NOMEM,
        NONAME,
        NOTIMP,
        NOTINITIALIZED
      ];
      const strategy = new UniversalFailoverStrategy();
      for (const code of cacheErrorCodes) {
        ok(strategy.cacheResolverFailure(createError(code)));
      }
      for (const code of notCacheErrors) {
        strictEqual(strategy.cacheResolverFailure(createError(code)), false);
      }
    });

    it('Tells to cache these errors for UniversalFailoverStrategyOptions#cacheErrorTtlMs time.', () => {
      const cacheErrorCodes = ['cache this', 'cache that'];
      const cacheErrorTtlMs = 5000;
      const strategy = new UniversalFailoverStrategy({ cacheErrorCodes, cacheErrorTtlMs });
      for (const code of cacheErrorCodes) {
        deepEqual(strategy.cacheResolverFailure(createError(code)), { ttlMs: cacheErrorTtlMs });
      }
    });

    it('By default UniversalFailoverStrategyOptions#cacheErrorTtlMs is equal to 1 second', () => {
      const cacheErrorCodes = ['cache this', 'cache that'];
      const strategy = new UniversalFailoverStrategy({ cacheErrorCodes });
      for (const code of cacheErrorCodes) {
        deepEqual(strategy.cacheResolverFailure(createError(code)), { ttlMs: 1000 });
      }
    });
  });

  describe('#useExpiredCache', () => {
    it('Forbid expired cache usage when error not in {@link UniversalFailoverStrategyOptions#cacheErrorCodes} list.', () => {
      const strategy = new UniversalFailoverStrategy({ useExpiredCacheOnErrorCodes: ['cache code'] });
      strictEqual(strategy.useExpiredCache(createError('do not cache this')), false);
      strictEqual(strategy.useExpiredCache(createError('do not cache that')), false);
    });

    it('Allows expired cache usage only on errors from {@link UniversalFailoverStrategyOptions#useExpiredCacheOnErrorCodes} list.', () => {
      const useExpiredCacheOnErrorCodes = ['cache this', 'cache that'];
      const strategy = new UniversalFailoverStrategy({ useExpiredCacheOnErrorCodes });
      for (const code of useExpiredCacheOnErrorCodes) {
        ok(strategy.useExpiredCache(createError(code)));
      }
    });

    it('By default UniversalFailoverStrategyOptions#useExpiredCacheOnErrorCodes is [dns.CONNREFUSED,dns.NOTFOUND,dns.REFUSED,dns.SERVFAIL,dns.TIMEOUT]', () => {
      const useExpiredCacheOnErrorCodes = [CONNREFUSED, NOTFOUND, REFUSED, SERVFAIL, TIMEOUT];
      const notUseExpiredCacheOnErrorCodes = [
        BADFAMILY,
        BADFLAGS,
        BADHINTS,
        BADNAME,
        BADQUERY,
        BADRESP,
        BADSTR,
        CANCELLED,
        FORMERR,
        NODATA,
        NOMEM,
        NONAME,
        NOTIMP,
        NOTINITIALIZED
      ];
      const strategy = new UniversalFailoverStrategy();
      for (const code of useExpiredCacheOnErrorCodes) {
        ok(strategy.useExpiredCache(createError(code)));
      }
      for (const code of notUseExpiredCacheOnErrorCodes) {
        strictEqual(strategy.useExpiredCache(createError(code)), false);
      }
    });

    it('Allows to use only cache expired less then {@link UniversalFailoverStrategyOptions#cacheMaxExpirationMs} ago.', () => {
      const useExpiredCacheOnErrorCodes = ['cache this', 'cache that'];
      const cacheMaxExpirationMs = 5000;
      const strategy = new UniversalFailoverStrategy({ cacheMaxExpirationMs, useExpiredCacheOnErrorCodes });
      for (const code of useExpiredCacheOnErrorCodes) {
        deepEqual(strategy.useExpiredCache(createError(code)), { maxExpirationMs: cacheMaxExpirationMs });
      }
    });

    it('By default UniversalFailoverStrategyOptions#maxExpirationMs is equal to 1 hour', () => {
      const useExpiredCacheOnErrorCodes = ['cache this', 'cache that'];
      const strategy = new UniversalFailoverStrategy({ useExpiredCacheOnErrorCodes });
      for (const code of useExpiredCacheOnErrorCodes) {
        deepEqual(strategy.useExpiredCache(createError(code)), { maxExpirationMs: 3600_000 });
      }
    });
  });
});
