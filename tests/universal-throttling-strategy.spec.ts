import { ok, strictEqual, equal } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { UniversalThrottlingStrategy } from '../';
import { delay } from './util';

describe('UniversalThrottlingStrategy', () => {
  describe('#throttle', () => {
    it('Creates throttled version of function.', () => {
      const strategy = new UniversalThrottlingStrategy();
      const original = mock.fn(() => undefined);
      const throttled = strategy.throttle(original);
      equal(typeof throttled, 'function');
      throttled();
      ok(original.mock.callCount() > 0);
    });

    it('When called for first time, throttled function will execute original function and return original function execution result.', () => {
      const strategy = new UniversalThrottlingStrategy();
      const original = mock.fn(() => 'result');
      const throttled = strategy.throttle(original);
      const result = throttled();
      equal(original.mock.callCount(), 1);
      strictEqual(result, 'result');
    });

    it('When called later then UniversalThrottlingStrategyOptions#intervalMs since last original function execution, throttled function will execute original function again and return new original function execution result.', async () => {
      const strategy = new UniversalThrottlingStrategy({ intervalMs: 100 });
      const results = ['first', 'second', 'third'];
      const original = mock.fn(() => results.shift());
      const throttled = strategy.throttle(original);

      strictEqual(throttled(), 'first');
      equal(original.mock.callCount(), 1);

      await delay(101);
      strictEqual(throttled(), 'second');
      equal(original.mock.callCount(), 2);

      await delay(101);
      strictEqual(throttled(), 'third');
      equal(original.mock.callCount(), 3);
    });

    it('When called less then UniversalThrottlingStrategyOptions#intervalMs since last original function execution, throttled function will skip original function execution and return latest original function execution result.', async () => {
      const strategy = new UniversalThrottlingStrategy({ intervalMs: 200 });
      const results = ['first', 'second', 'third'];
      const original = mock.fn(() => results.shift());
      const throttled = strategy.throttle(original);

      strictEqual(throttled(), 'first');
      equal(original.mock.callCount(), 1);
      for (let i = 0; i < 3; i++) {
        await delay(50);
        strictEqual(throttled(), 'first');
        equal(original.mock.callCount(), 1);
      }

      await delay(51);
      strictEqual(throttled(), 'second');
      equal(original.mock.callCount(), 2);
      for (let i = 0; i < 3; i++) {
        await delay(50);
        strictEqual(throttled(), 'second');
        equal(original.mock.callCount(), 2);
      }

      await delay(51);
      strictEqual(throttled(), 'third');
      equal(original.mock.callCount(), 3);
      for (let i = 0; i < 3; i++) {
        await delay(50);
        strictEqual(throttled(), 'third');
        equal(original.mock.callCount(), 3);
      }
    });

    it('Never calls original function after throttled function completion (i.e. no trailing call after {@link UniversalThrottlingStrategyOptions#intervalMs}', async () => {
      const strategy = new UniversalThrottlingStrategy({ intervalMs: 100 });
      const original = mock.fn(() => undefined);
      const throttled = strategy.throttle(original);

      throttled();
      equal(original.mock.callCount(), 1);

      await delay(50);
      throttled();
      equal(original.mock.callCount(), 1);

      await delay(100);
      equal(original.mock.callCount(), 1);
    });
  });
});
