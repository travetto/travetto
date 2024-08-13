import assert from 'node:assert';

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
    assert.throws(() => DataUtil.coerceType('trueE', Boolean));
    assert.doesNotThrow(() => DataUtil.coerceType('trueE', Boolean, false));
    assert(!DataUtil.coerceType('trueE', Boolean, false));
  }

  @Test()
  testCoerceNumericType() {
    assert(DataUtil.coerceType(0, Number) === 0);
    assert(DataUtil.coerceType('0', Number) === 0);
    assert(DataUtil.coerceType('-1', Number) === -1);
    assert(DataUtil.coerceType('20.323', Number) === 20.323);
    assert.throws(() => DataUtil.coerceType('trueE', Number));
    assert.doesNotThrow(() => DataUtil.coerceType('trueE', Number, false));
    assert(Number.isNaN(DataUtil.coerceType('trueE', Number, false)));
  }

  @Test()
  testCoerceBigintType() {
    assert(DataUtil.coerceType('0n', BigInt) === 0n);
    assert(DataUtil.coerceType(0n, BigInt) === 0n);
    assert(DataUtil.coerceType('-1', BigInt) === -1n);
    assert(DataUtil.coerceType('20', BigInt) === 20n);
    assert.throws(() => DataUtil.coerceType('20.333', BigInt) === 20n);
    assert(DataUtil.coerceType(true, BigInt) === 1n);
  }


  @Test()
  testCoerceDateType() {
    assert(DataUtil.coerceType(2014, Date).getTime() === new Date(2014).getTime());
    assert(DataUtil.coerceType('2014', Date).getTime() === new Date(2014).getTime());
    assert(DataUtil.coerceType('2018-01-01', Date).toString() === new Date('2018-01-01').toString());
    assert.throws(() => DataUtil.coerceType('a', Date));
    assert.doesNotThrow(() => DataUtil.coerceType('a', Date, false));
    assert(Number.isNaN(DataUtil.coerceType('a', Date, false).getTime()));

    const obj = { toDate: () => new Date(10) };
    assert(DataUtil.coerceType(obj, Date).getTime() === 10);
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

  @Test()
  verifyFalseBooleanOverride() {
    const data: { showTime: 's' | 'ms' | false } = {
      showTime: 's'
    };

    DataUtil.deepAssign(data, { showTime: false }, 'coerce');
    // @ts-expect-error
    assert(data.showTime === 'false');
  }

  @Test()
  verifyFilterByKeys() {
    assert.deepStrictEqual(DataUtil.filterByKeys({ name: 'bob', age: 20 }, ['age']), { name: 'bob' });
    assert.deepStrictEqual(DataUtil.filterByKeys({ name: 'bob', age: 20 }, [/age/]), { name: 'bob' });
    assert.deepStrictEqual(DataUtil.filterByKeys({ name: 'bob', age: 20 }, [/Age/i]), { name: 'bob' });
    assert.deepStrictEqual(DataUtil.filterByKeys({ name: 'bob', age: 20 }, [/a/]), {});
    assert.deepStrictEqual(DataUtil.filterByKeys({ name: 'bob', age: 20 }, ['age', /name/]), {});
    assert.deepStrictEqual(DataUtil.filterByKeys({ name: 'bob', age: 20 }, ['age', /namE/]), { name: 'bob' });
    assert.deepStrictEqual(
      DataUtil.filterByKeys({ name: 'bob', age: 20, child: { age: 11, name: 'gob' } }, ['age', /namE/]),
      { name: 'bob', child: { name: 'gob' } }
    );
    assert.deepStrictEqual(
      DataUtil.filterByKeys({ name: 'bob', age: 20, child: { age: 11, name: 'gob' } }, []),
      { name: 'bob', age: 20, child: { name: 'gob', age: 11 } }
    );
  }

  @Test()
  verifySimple() {
    assert(DataUtil.isSimpleValue(5));
    assert(DataUtil.isSimpleValue(Number(5)));
    assert(DataUtil.isSimpleValue(Boolean(5)));
    assert(DataUtil.isSimpleValue(Function));
    assert(DataUtil.isSimpleValue(() => { }));
    assert(DataUtil.isSimpleValue(class { }));
    assert(!DataUtil.isSimpleValue(new class { }()));
  }

  @Test()
  testPrimitive() {
    for (const v of [1, '1', true, false, 0.0, /ab/g, new Date()]) {
      assert(DataUtil.isPrimitive(v));
    }

    for (const v of [[], {}, () => { }, new class { }(), null, undefined]) {
      assert(!DataUtil.isPrimitive(v));
    }
  }


  @Test()
  verifyPrimitive() {
    assert(DataUtil.isPrimitive(5));
    // eslint-disable-next-line no-new-wrappers
    assert(DataUtil.isPrimitive(new String('5')));
    assert(DataUtil.isPrimitive(String('5')));
    assert(DataUtil.isPrimitive('5'));
    // eslint-disable-next-line no-new-wrappers
    assert(DataUtil.isPrimitive(new Number(5)));
    assert(DataUtil.isPrimitive(Number(5)));

    assert(DataUtil.isPrimitive(false));
    // eslint-disable-next-line no-new-wrappers
    assert(DataUtil.isPrimitive(new Boolean('true')));
    assert(DataUtil.isPrimitive(Boolean('false')));

    assert(DataUtil.isPrimitive(new Date()));
    assert(DataUtil.isPrimitive(/./));
    assert(DataUtil.isPrimitive(new RegExp('.')));
    assert(!DataUtil.isPrimitive(Function));
    assert(!DataUtil.isPrimitive(class { }));
    assert(!DataUtil.isPrimitive(new class { }()));
  }

  @Test()
  verifyObject() {
    assert(DataUtil.isPlainObject({}));
    assert(DataUtil.isPlainObject(Object.create({})));
    assert(DataUtil.isPlainObject(Object.create(null)) !== true);
    assert(DataUtil.isPlainObject(Object.create(Function)) !== true);
    assert(DataUtil.isPlainObject(new class { }()) !== true);
  }
}
