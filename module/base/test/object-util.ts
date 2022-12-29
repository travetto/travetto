import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { ObjectUtil } from '../src/object-util';

class Test2 { }

@Suite()
class UtilTests {

  @Test()
  testPrimitive() {
    for (const v of [1, '1', true, false, 0.0, /ab/g, new Date()]) {
      assert(ObjectUtil.isPrimitive(v));
    }

    for (const v of [[], {}, () => { }, new Test2(), null, undefined]) {
      assert(!ObjectUtil.isPrimitive(v));
    }

    assert(ObjectUtil.isFunction(Test));
  }

  @Test()
  testCoerceNothing() {
    assert(ObjectUtil.coerceType(null, Boolean) === null);
    assert(ObjectUtil.coerceType(undefined, RegExp) === undefined);
  }

  @Test()
  testCoerceBooleanType() {
    assert(!ObjectUtil.coerceType(false, Boolean));
    assert(!ObjectUtil.coerceType('false', Boolean));
    assert(!ObjectUtil.coerceType('off', Boolean));
    assert(!ObjectUtil.coerceType('no', Boolean));
    assert(!ObjectUtil.coerceType('0', Boolean));
    assert(ObjectUtil.coerceType('1', Boolean));
    assert(ObjectUtil.coerceType(true, Boolean));
    assert(ObjectUtil.coerceType('yes', Boolean));
    assert(ObjectUtil.coerceType('on', Boolean));
    assert(ObjectUtil.coerceType('true', Boolean));
    assert.throws(() => ObjectUtil.coerceType('truee', Boolean));
    assert.doesNotThrow(() => ObjectUtil.coerceType('truee', Boolean, false));
    assert(!ObjectUtil.coerceType('truee', Boolean, false));
  }

  @Test()
  testCoerceNumericType() {
    assert(ObjectUtil.coerceType(0, Number) === 0);
    assert(ObjectUtil.coerceType('0', Number) === 0);
    assert(ObjectUtil.coerceType('-1', Number) === -1);
    assert(ObjectUtil.coerceType('20.323', Number) === 20.323);
    assert.throws(() => ObjectUtil.coerceType('truee', Number));
    assert.doesNotThrow(() => ObjectUtil.coerceType('truee', Number, false));
    assert(Number.isNaN(ObjectUtil.coerceType('truee', Number, false)));
  }

  @Test()
  testCoerceDateType() {
    assert(ObjectUtil.coerceType(2014, Date).getTime() === new Date(2014).getTime());
    assert(ObjectUtil.coerceType('2014', Date).getTime() === new Date(2014).getTime());
    assert(ObjectUtil.coerceType('2018-01-01', Date).toString() === new Date('2018-01-01').toString());
    assert.throws(() => ObjectUtil.coerceType('a', Date));
    assert.doesNotThrow(() => ObjectUtil.coerceType('a', Date, false));
    assert(Number.isNaN(ObjectUtil.coerceType('a', Date, false).getTime()));
  }

  @Test()
  testCoerceRegex() {
    assert(ObjectUtil.coerceType(/a/, RegExp).source === 'a');
    assert(ObjectUtil.coerceType('/abc/i', RegExp).flags === 'i');
    assert(ObjectUtil.coerceType('/abc/i', RegExp).source === 'abc');
    assert(ObjectUtil.coerceType('abc', RegExp).source === 'abc');
    assert(ObjectUtil.coerceType('(', RegExp, false) === undefined);
    assert.throws(() => ObjectUtil.coerceType('(', RegExp));
  }

  @Test()
  testMerge() {
    assert(ObjectUtil.deepAssign({ a: 1, b: 2 }, { a: 5 }).a === 5);
    assert(typeof ObjectUtil.deepAssign({ a: 1, b: () => { } }, { a: 5, c: 10 }).b !== 'number');
    assert.deepEqual(ObjectUtil.deepAssign({ a: 1, b: () => { }, d: [1, 2, 3] }, { a: 5, c: 10, d: [1, 5, 6, 7] }).d, [1, 5, 6, 7]);

    const right = {
      lines: { start: 15, end: 21 },
      file: '/home/code/travetto/test/test/simple.1.ts',
      description: undefined
    };
    const left = {
      file: '/home/code/travetto/test/test/simple.1.ts',
      methodName: 'test1a'
    };

    const merged = ObjectUtil.deepAssign(left, right);
    assert.deepEqual(merged.lines, { start: 15, end: 21 });
    assert(merged.methodName === 'test1a');
    assert(merged.file === left.file);

    assert.strictEqual(ObjectUtil.deepAssign({ a: {} }, { a: { b: Test } }).a.b, Test);

    // @ts-expect-error
    assert(ObjectUtil.deepAssign({ a: { b: 5 } }, { a: null }).a === null);
    // @ts-expect-error
    assert.deepEqual(ObjectUtil.deepAssign({ a: { b: 5 } }, { a: undefined }).a, { b: 5 });

    assert(ObjectUtil.deepAssign({ line: 20, file: 30 }, { description: undefined }).description === undefined);
  }

  @Test()
  testStrict() {
    assert.throws(() =>
      ObjectUtil.deepAssign({ a: 1 }, { a: '5' }, 'strict')
    );
  }

  @Test()
  testCoerce() {
    assert(ObjectUtil.deepAssign({ a: 1 }, { a: '5' }, 'coerce').a === 5);
    assert(ObjectUtil.deepAssign({ a: '1' }, { a: 5 }, 'coerce').a === '5');
    // @ts-expect-error
    assert(isNaN(ObjectUtil.deepAssign({ a: 1 }, { a: true }, 'coerce').a));
    // @ts-expect-error
    assert(ObjectUtil.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
    // @ts-expect-error
    assert(ObjectUtil.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
  }

  @Test()
  testReplace() {
    assert.deepStrictEqual(ObjectUtil.deepAssign({ a: [1, 2, 3] }, { a: [1, 2] }, 'replace').a, [1, 2]);
    // @ts-expect-error
    assert.deepStrictEqual(ObjectUtil.deepAssign({ a: [1, 2, 3] }, { a: undefined }, 'replace').a, undefined);
    assert.deepStrictEqual(ObjectUtil.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { c: [1, 2] } }, 'replace').a, { b: 5, c: [1, 2] });
    // @ts-expect-error
    assert.deepStrictEqual(ObjectUtil.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { b: undefined, c: [1, 2] } }, 'replace').a.c, [1, 2]);
    // @ts-expect-error
    assert.deepStrictEqual(ObjectUtil.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { b: undefined, c: [1, 2] } }, 'replace').a.b, undefined);
  }

  @Test()
  verifyFunction() {
    async function test() {
      // Do nothing
    }

    assert(ObjectUtil.isFunction(test));
    assert(ObjectUtil.isSimple(test));
    assert(ObjectUtil.shallowClone(test) === test);
  }
}
