import * as assert from 'assert';

import { Util } from '../src/util';

class Test { }

function testPrimitive() {
  for (const v of [1, '1', true, false, 0.0, /ab/g]) {
    assert(Util.isPrimitive(v));
  }

  for (const v of [[], {}, () => { }, new Test(), null, undefined]) {
    assert(!Util.isPrimitive(v));
  }

  assert(Util.isFunction(Test));
}

function testMerge() {
  assert(Util.deepAssign({ a: 1, b: 2 }, { a: 5 }).a === 5);
  assert(typeof Util.deepAssign({ a: 1, b: () => { } }, { a: 5, c: 10 }).b !== 'number');
  assert.deepEqual(Util.deepAssign({ a: 1, b: () => { }, d: [1, 2, 3] }, { a: 5, c: 10, d: [1, 5, 6, 7] }).d, [1, 5, 6, 7]);

  const right = {
    lines: { start: 15, end: 21 },
    file: '/home/tim/Code/travetto/test/test/simple.1.ts',
    description: undefined
  };
  const left = {
    file: '/home/tim/Code/travetto/test/test/simple.1.ts',
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

function testStrict() {
  assert.throws(() =>
    Util.deepAssign({ a: 1 }, { a: '5' }, 'strict')
  );
}

function testCoerce() {
  assert(Util.deepAssign({ a: 1 }, { a: '5' }, 'coerce').a === 5);
  assert(Util.deepAssign({ a: '1' }, { a: 5 }, 'coerce').a === '5');
  assert(isNaN(Util.deepAssign({ a: 1 }, { a: true }, 'coerce').a));
  assert(Util.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
  assert(Util.deepAssign({ a: true }, { a: null }, 'coerce').a === null);
}

testPrimitive();
testMerge();
testStrict();
testCoerce();