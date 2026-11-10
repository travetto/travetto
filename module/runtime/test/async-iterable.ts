import assert from 'node:assert';

import { AsyncIterableHelper, CodecUtil } from '@travetto/runtime';
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

    const collected: number[] = [];
    for await (const item of generate()) {
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

    assert.deepStrictEqual(await AsyncIterableHelper.from(generate()).toArray(), ['a', 'b']);
  }

  @Test()
  async verifyMapSyncAndAsync() {
    const iterable = async function* () {
      yield 1;
      yield 2;
      yield 3;
    };

    const doubled = await AsyncIterableHelper.from(iterable())
      .map(item => item * 2)
      .toArray();
    assert.deepStrictEqual(doubled, [2, 4, 6]);

    const asyncIterable = async function* () {
      yield 'hello';
      yield 'world';
    };

    const uppercase = await AsyncIterableHelper.from(asyncIterable())
      .map(async item => item.toUpperCase())
      .toArray();
    assert.deepStrictEqual(uppercase, ['HELLO', 'WORLD']);
  }

  @Test()
  async verifyMapSkipsUndefined() {
    const iterable = async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    };

    const evensOnly = await AsyncIterableHelper.from(iterable())
      .map(item => (item % 2 === 0 ? item * 10 : undefined))
      .filter(Boolean)
      .toArray();
    assert.deepStrictEqual(evensOnly, [20, 40]);
  }

  @Test()
  async verifyFilterSyncAndAsync() {
    const iterable = async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    };

    const filtered = await AsyncIterableHelper.from(iterable())
      .filter(item => item > 2)
      .toArray();
    assert.deepStrictEqual(filtered, [3, 4, 5]);

    const asyncIterable = async function* () {
      yield 'apple';
      yield 'banana';
      yield 'avocado';
    };

    const startsWithA = await AsyncIterableHelper.from(asyncIterable())
      .filter(async item => item.startsWith('a'))
      .toArray();
    assert.deepStrictEqual(startsWithA, ['apple', 'avocado']);
  }

  @Test()
  async verifyChaining() {
    const iterable = async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    };

    const result = await AsyncIterableHelper.from(iterable())
      .filter(item => item % 2 !== 0)
      .map(item => item * 10)
      .map(item => `${item}!`)
      .toArray();

    assert.deepStrictEqual(result, ['10!', '30!', '50!']);
  }

  @Test()
  async verifyToArray() {
    const emptyIterable = async function* () {};
    assert.deepStrictEqual(await AsyncIterableHelper.from(emptyIterable()).toArray(), []);

    const singleIterable = async function* () {
      yield 42;
    };
    assert.deepStrictEqual(await AsyncIterableHelper.from(singleIterable()).toArray(), [42]);
  }

  @Test()
  async verifyReduce() {
    const iterable = async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    };

    const sum = await AsyncIterableHelper.from(iterable()).reduce((acc, val) => acc + val, 0);
    assert.strictEqual(sum, 10);
  }

  @Test()
  async verifyAsyncIteratorFrom() {
    const fromArray = await AsyncIterableHelper.from(async function* () {
      yield* [10, 20, 30];
    })
      .map(x => x * 2)
      .toArray();
    assert.deepStrictEqual(fromArray, [20, 40, 60]);

    async function* gen() {
      yield 'hello';
      yield 'world';
    }
    const fromGen = await AsyncIterableHelper.from(gen()).toArray();
    assert.deepStrictEqual(fromGen, ['hello', 'world']);
  }

  @Test()
  async verifyFlatMapWithToLines() {
    const stream = async function* () {
      yield 'line1\nline2\n';
    };
    const lines = await AsyncIterableHelper.from(stream()).flatMap(CodecUtil.toLines()).toArray();
    assert.deepStrictEqual(lines, ['line1', 'line2']);
  }
}
