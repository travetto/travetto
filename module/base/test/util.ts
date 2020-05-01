import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { Util } from '../src/util';

class Test2 { }

@Suite()
class UtilTests {

  @Test()
  testPrimitive() {
    for (const v of [1, '1', true, false, 0.0, /ab/g, new Date()]) {
      assert(Util.isPrimitive(v));
    }

    for (const v of [[], {}, () => { }, new Test2(), null, undefined]) {
      assert(!Util.isPrimitive(v));
    }

    assert(Util.isFunction(Test));
  }

  @Test()
  testCoerceNothing() {
    assert(Util.coerceType(null, Boolean) === null);
    assert(Util.coerceType(undefined, RegExp) === undefined);
  }

  @Test()
  testCoerceBooleanType() {
    assert(!Util.coerceType(false, Boolean));
    assert(!Util.coerceType('false', Boolean));
    assert(!Util.coerceType('off', Boolean));
    assert(!Util.coerceType('no', Boolean));
    assert(!Util.coerceType('0', Boolean));
    assert(Util.coerceType('1', Boolean));
    assert(Util.coerceType(true, Boolean));
    assert(Util.coerceType('yes', Boolean));
    assert(Util.coerceType('on', Boolean));
    assert(Util.coerceType('true', Boolean));
    assert.throws(() => Util.coerceType('truee', Boolean));
    assert.doesNotThrow(() => Util.coerceType('truee', Boolean, false));
    assert(!Util.coerceType('truee', Boolean, false));
  }

  @Test()
  testCoerceNumericType() {
    assert(Util.coerceType(0, Number) === 0);
    assert(Util.coerceType('0', Number) === 0);
    assert(Util.coerceType('-1', Number) === -1);
    assert(Util.coerceType('20.323', Number) === 20.323);
    assert.throws(() => Util.coerceType('truee', Number));
    assert.doesNotThrow(() => Util.coerceType('truee', Number, false));
    assert(Number.isNaN(Util.coerceType('truee', Number, false)));
  }

  @Test()
  testCoerceDateType() {
    assert(Util.coerceType(2014, Date).getTime() === new Date(2014).getTime());
    assert(Util.coerceType('2014', Date).getTime() === new Date(2014).getTime());
    assert(Util.coerceType('2018-01-01', Date).toString() === new Date('2018-01-01').toString());
    assert.throws(() => Util.coerceType('a', Date));
    assert.doesNotThrow(() => Util.coerceType('a', Date, false));
    assert(Number.isNaN(Util.coerceType('a', Date, false).getTime()));
  }

  @Test()
  testCoerceRegex() {
    assert(Util.coerceType(/a/, RegExp).source === 'a');
    assert(Util.coerceType('/abc/i', RegExp).flags === 'i');
    assert(Util.coerceType('/abc/i', RegExp).source === 'abc');
    assert(Util.coerceType('abc', RegExp).source === 'abc');
    assert(Util.coerceType('(', RegExp, false) === undefined);
    assert.throws(() => Util.coerceType('(', RegExp));
  }

  @Test()
  testMerge() {
    assert(Util.deepAssign({ a: 1, b: 2 }, { a: 5 }).a === 5);
    assert(typeof Util.deepAssign({ a: 1, b: () => { } }, { a: 5, c: 10 }).b !== 'number');
    assert.deepEqual(Util.deepAssign({ a: 1, b: () => { }, d: [1, 2, 3] }, { a: 5, c: 10, d: [1, 5, 6, 7] }).d, [1, 5, 6, 7]);

    const right = {
      lines: { start: 15, end: 21 },
      file: '/home/code/travetto/test/test/simple.1.ts',
      description: undefined
    };
    const left = {
      file: '/home/code/travetto/test/test/simple.1.ts',
      methodName: 'test1a'
    };

    const merged = Util.deepAssign(left, right);
    assert.deepEqual(merged.lines, { start: 15, end: 21 });
    assert(merged.methodName === 'test1a');
    assert(merged.file === left.file);

    assert.strictEqual(Util.deepAssign({ a: {} }, { a: { b: Test } }).a.b, Test);

    assert(Util.deepAssign({ a: { b: 5 } }, { a: null }).a === null);
    assert.deepEqual(Util.deepAssign({ a: { b: 5 } }, { a: undefined }).a, { b: 5 });

    assert(Util.deepAssign({ line: 20, file: 30 }, { description: undefined }).description === undefined);
  }

  @Test()
  testStrict() {
    assert.throws(() =>
      Util.deepAssign({ a: 1 }, { a: '5' }, 'strict')
    );
  }

  @Test()
  testCoerce() {
    assert(Util.deepAssign({ a: 1 }, { a: '5' }, 'coerce').a === 5);
    assert(Util.deepAssign({ a: '1' }, { a: 5 }, 'coerce').a === '5');
    assert(isNaN(Util.deepAssign({ a: 1 }, { a: true }, 'coerce').a));
    assert(Util.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
    assert(Util.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
  }

  @Test()
  testReplace() {
    assert(Util.deepAssign({ a: [1, 2, 3] }, { a: [1, 2] }, 'replace').a === [1, 2]);
    assert(Util.deepAssign({ a: [1, 2, 3] }, { a: undefined }, 'replace').a === undefined);
    assert(Util.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { c: [1, 2] } }, 'replace').a === { b: 5, c: [1, 2] });
    assert(Util.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { b: undefined, c: [1, 2] } }, 'replace').a.c === [1, 2]);
    assert(Util.deepAssign({ a: { b: 5, c: [1, 2, 3] } }, { a: { b: undefined, c: [1, 2] } }, 'replace').a.b === undefined);
  }

  @Test()
  verifyFunction() {
    async function test() {
      // Do nothing
    }

    assert(Util.isFunction(test));
    assert(Util.isSimple(test));
    assert(Util.shallowClone(test) === test);
  }

  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }
}
