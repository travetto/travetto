import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { DataUtil } from '../src/data';

@Suite()
class DataUtilTests {

  @Test()
  testCoerceNothing() {
    assert(DataUtil.coerceType(null, Boolean) === null);
    assert(DataUtil.coerceType(undefined, RegExp) === undefined);
  }

  @Test()
  testCoerceBooleanType() {
    assert(!DataUtil.coerceType(false, Boolean));
    assert(!DataUtil.coerceType('false', Boolean));
    assert(!DataUtil.coerceType('off', Boolean));
    assert(!DataUtil.coerceType('no', Boolean));
    assert(!DataUtil.coerceType('0', Boolean));
    assert(DataUtil.coerceType('1', Boolean));
    assert(DataUtil.coerceType(true, Boolean));
    assert(DataUtil.coerceType('yes', Boolean));
    assert(DataUtil.coerceType('on', Boolean));
    assert(DataUtil.coerceType('true', Boolean));
    assert.throws(() => DataUtil.coerceType('truee', Boolean));
    assert.doesNotThrow(() => DataUtil.coerceType('truee', Boolean, false));
    assert(!DataUtil.coerceType('truee', Boolean, false));
  }

  @Test()
  testCoerceNumericType() {
    assert(DataUtil.coerceType(0, Number) === 0);
    assert(DataUtil.coerceType('0', Number) === 0);
    assert(DataUtil.coerceType('-1', Number) === -1);
    assert(DataUtil.coerceType('20.323', Number) === 20.323);
    assert.throws(() => DataUtil.coerceType('truee', Number));
    assert.doesNotThrow(() => DataUtil.coerceType('truee', Number, false));
    assert(Number.isNaN(DataUtil.coerceType('truee', Number, false)));
  }

  @Test()
  testCoerceDateType() {
    assert(DataUtil.coerceType(2014, Date).getTime() === new Date(2014).getTime());
    assert(DataUtil.coerceType('2014', Date).getTime() === new Date(2014).getTime());
    assert(DataUtil.coerceType('2018-01-01', Date).toString() === new Date('2018-01-01').toString());
    assert.throws(() => DataUtil.coerceType('a', Date));
    assert.doesNotThrow(() => DataUtil.coerceType('a', Date, false));
    assert(Number.isNaN(DataUtil.coerceType('a', Date, false).getTime()));
  }

  @Test()
  testCoerceRegex() {
    assert(DataUtil.coerceType(/a/, RegExp).source === 'a');
    assert(DataUtil.coerceType('/abc/i', RegExp).flags === 'i');
    assert(DataUtil.coerceType('/abc/i', RegExp).source === 'abc');
    assert(DataUtil.coerceType('abc', RegExp).source === 'abc');
    assert(DataUtil.coerceType('(', RegExp, false) === undefined);
    assert.throws(() => DataUtil.coerceType('(', RegExp));
  }

  @Test()
  testMerge() {
    assert(DataUtil.deepAssign({ a: 1, b: 2 }, { a: 5 }).a === 5);
    assert(typeof DataUtil.deepAssign({ a: 1, b: () => { } }, { a: 5, c: 10 }).b !== 'number');
    assert.deepEqual(DataUtil.deepAssign({ a: 1, b: () => { }, d: [1, 2, 3] }, { a: 5, c: 10, d: [1, 5, 6, 7] }).d, [1, 5, 6, 7]);

    const right = {
      lines: { start: 15, end: 21 },
      file: '/home/code/travetto/test/test/simple.1.ts',
      description: undefined
    };
    const left = {
      file: '/home/code/travetto/test/test/simple.1.ts',
      methodName: 'test1a'
    };

    const merged = DataUtil.deepAssign(left, right);
    assert.deepEqual(merged.lines, { start: 15, end: 21 });
    assert(merged.methodName === 'test1a');
    assert(merged.file === left.file);

    assert.strictEqual(DataUtil.deepAssign({ a: {} }, { a: { b: Test } }).a.b, Test);

    // @ts-expect-error
    assert(DataUtil.deepAssign({ a: { b: 5 } }, { a: null }).a === null);
    // @ts-expect-error
    assert.deepEqual(DataUtil.deepAssign({ a: { b: 5 } }, { a: undefined }).a, { b: 5 });

    assert(DataUtil.deepAssign({ line: 20, file: 30 }, { description: undefined }).description === undefined);
  }

  @Test()
  testStrict() {
    assert.throws(() =>
      DataUtil.deepAssign({ a: 1 }, { a: '5' }, 'strict')
    );
  }

  @Test()
  testCoerce() {
    assert(DataUtil.deepAssign({ a: 1 }, { a: '5' }, 'coerce').a === 5);
    assert(DataUtil.deepAssign({ a: '1' }, { a: 5 }, 'coerce').a === '5');
    // @ts-expect-error
    assert(isNaN(DataUtil.deepAssign({ a: 1 }, { a: true }, 'coerce').a));
    // @ts-expect-error
    assert(DataUtil.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
    // @ts-expect-error
    assert(DataUtil.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
  }

  @Test()
  testReplace() {
    assert.deepStrictEqual(DataUtil.deepAssign({ a: [1, 2, 3] }, { a: [1, 2] }, 'replace').a, [1, 2]);
    // @ts-expect-error
    assert.deepStrictEqual(DataUtil.deepAssign({ a: [1, 2, 3] }, { a: undefined }, 'replace').a, undefined);
    assert.deepStrictEqual(DataUtil.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { c: [1, 2] } }, 'replace').a, { b: 5, c: [1, 2] });
    // @ts-expect-error
    assert.deepStrictEqual(DataUtil.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { b: undefined, c: [1, 2] } }, 'replace').a.c, [1, 2]);
    // @ts-expect-error
    assert.deepStrictEqual(DataUtil.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { b: undefined, c: [1, 2] } }, 'replace').a.b, undefined);
  }

  @Test()
  verifyFunction() {
    async function test() {
      // Do nothing
    }

    assert(DataUtil.shallowClone(test) === test);
  }
}
