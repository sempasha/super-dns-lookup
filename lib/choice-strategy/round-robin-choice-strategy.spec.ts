import { equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RoundRobinChoiceStrategy } from './round-robin-choice-strategy';

describe('RoundRobinChoiceStrategy', () => {
  describe('#chooseOne', () => {
    it('Selects the single element of entire list of elements.', () => {
      const strategy = new RoundRobinChoiceStrategy();
      const array = [{ id: 'first' }, { id: 'second' }];
      const theOne = strategy.chooseOne(array);
      ok(array.includes(theOne));
    });

    it('Returns first array element when called first time with specified array.', () => {
      const strategy = new RoundRobinChoiceStrategy();
      for (const array of [
        [{ id: 1 }, { id: 2 }, { id: 3 }] as object[],
        [{ id: 'first' }, { id: 'second' }, { id: 'third' }] as object[]
      ]) {
        equal(strategy.chooseOne(array), array[0]);
      }
    });

    it('Returns next array element on each subsequent call.', () => {
      const strategy = new RoundRobinChoiceStrategy();
      for (const array of [
        [{ id: 1 }, { id: 2 }, { id: 3 }] as object[],
        [{ id: 'first' }, { id: 'second' }, { id: 'third' }] as object[]
      ]) {
        equal(strategy.chooseOne(array), array[0]);
        equal(strategy.chooseOne(array), array[1]);
      }
    });

    it(
      'Returns first element again when last array element has been reached on previous call, ' +
        'completing the round this way.',
      () => {
        const strategy = new RoundRobinChoiceStrategy();
        for (const array of [
          [{ id: 1 }, { id: 2 }, { id: 3 }] as object[],
          [{ id: 'first' }, { id: 'second' }, { id: 'third' }] as object[]
        ]) {
          equal(strategy.chooseOne(array), array[0]);
          equal(strategy.chooseOne(array), array[1]);
          equal(strategy.chooseOne(array), array[2]);
          equal(strategy.chooseOne(array), array[0]);
        }
      }
    );

    it('Repeat iterations round by round again and again.', () => {
      const strategy = new RoundRobinChoiceStrategy();
      for (const array of [
        [{ id: 1 }, { id: 2 }, { id: 3 }] as object[],
        [{ id: 'first' }, { id: 'second' }, { id: 'third' }] as object[]
      ]) {
        for (let i = 0; i < 100; i++) {
          equal(strategy.chooseOne(array), array[i % array.length]);
        }
      }
    });
  });
});
