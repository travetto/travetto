import assert from 'node:assert';

import { CustomAsyncIterable } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

@Suite()
export class CustomAsyncIterableTest {
  @Test()
  async verifyBasicIteration() {
    async function* generate() {
      yield 1;
      yield 2;
      yield 3;
    }

    const iterable = new CustomAsyncIterable(generate);
    const collected: number[] = [];
    for await (const item of iterable) {
      collected.push(item);
    }
    assert.deepStrictEqual(collected, [1, 2, 3]);
  }

  @Test()
  async verifyDirectAsyncIterableConstructor() {
    async function* generate() {
      yield 'a';
      yield 'b';
    }

    const iterable = new CustomAsyncIterable(generate());
    assert.deepStrictEqual(await iterable.toArray(), ['a', 'b']);
  }

  @Test()
  async verifyMapSyncAndAsync() {
    const iterable = new CustomAsyncIterable(async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const doubled = await iterable.map(item => item * 2).toArray();
    assert.deepStrictEqual(doubled, [2, 4, 6]);

    const asyncIterable = new CustomAsyncIterable(async function* () {
      yield 'hello';
      yield 'world';
    });

    const uppercase = await asyncIterable.map(async item => item.toUpperCase()).toArray();
    assert.deepStrictEqual(uppercase, ['HELLO', 'WORLD']);
  }

  @Test()
  async verifyMapSkipsUndefined() {
    const iterable = new CustomAsyncIterable(async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    });

    const evensOnly = await iterable.map(item => (item % 2 === 0 ? item * 10 : undefined)).toArray();
    assert.deepStrictEqual(evensOnly, [20, 40]);
  }

  @Test()
  async verifyFilterSyncAndAsync() {
    const iterable = new CustomAsyncIterable(async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    });

    const filtered = await iterable.filter(item => item > 2).toArray();
    assert.deepStrictEqual(filtered, [3, 4, 5]);

    const asyncIterable = new CustomAsyncIterable(async function* () {
      yield 'apple';
      yield 'banana';
      yield 'avocado';
    });

    const startsWithA = await asyncIterable.filter(async item => item.startsWith('a')).toArray();
    assert.deepStrictEqual(startsWithA, ['apple', 'avocado']);
  }

  @Test()
  async verifyChaining() {
    const iterable = new CustomAsyncIterable(async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    });

    const result = await iterable
      .filter(item => item % 2 !== 0)
      .map(item => item * 10)
      .map(item => `${item}!`)
      .toArray();

    assert.deepStrictEqual(result, ['10!', '30!', '50!']);
  }

  @Test()
  async verifyToArray() {
    const emptyIterable = new CustomAsyncIterable(async function* () {});
    assert.deepStrictEqual(await emptyIterable.toArray(), []);

    const singleIterable = new CustomAsyncIterable(async function* () {
      yield 42;
    });
    assert.deepStrictEqual(await singleIterable.toArray(), [42]);
  }
}
