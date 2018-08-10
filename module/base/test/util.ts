import * as assert from 'assert';
import { Test, Suite } from '@travetto/test';

import { Util } from '../src/util';

class Test2 { }

@Suite()
class MergeTests {

  @Test()
  testPrimitive() {
    for (const v of [1, '1', true, false, 0.0, /ab/g]) {
      assert(Util.isPrimitive(v));
    }

    for (const v of [[], {}, () => { }, new Test2(), null, undefined]) {
      assert(!Util.isPrimitive(v));
    }

    assert(Util.isFunction(Test));
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
  verifyFunction() {
    async function test() {
      // Do nothing
    }

    assert(Util.isFunction(test));
    assert(Util.isSimple(test));
    assert(Util.shallowClone(test) === test);
  }

  @Test()
  orderDependents() {
    const items: any = [
      {
        key: 'first'
      },
      {
        after: ['first', 'fourth'],
        key: 'fifth'
      },
      {
        after: 'first',
        key: 'third'
      },
      {
        after: ['first'],
        key: 'second'
      },
      {
        after: new Set(['first', 'second']),
        key: 'fourth'
      },
      {
        after: new Set(['fifth']),
        key: 'sixth'
      }
    ];

    const order = Util.computeOrdering(items);
    const ordered = order.map(x => x.key);
    assert(ordered === ['first', 'third', 'second', 'fourth', 'fifth', 'sixth']);

    items.unshift({ key: 'tenth', before: 'second' });

    const order2 = Util.computeOrdering(items);
    const ordered2 = order2.map(x => x.key);
    assert(ordered2 === ['tenth', 'first', 'third', 'second', 'fourth', 'fifth', 'sixth']);
  }
}