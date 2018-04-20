import { deepMerge, isPrimitive } from '../src/util';
import * as assert from 'assert';

class Test { }

function testPrimitive() {
  for (const v of [1, '1', true, false, 0.0, /ab/g]) {
    assert(isPrimitive(v));
  }

  for (const v of [[], {}, () => { }, new Test(), null, undefined]) {
    assert(!isPrimitive(v));
  }
}

function testMerge() {
  assert(deepMerge({ a: 1, b: 2 }, { a: 5 }).a === 5);
  assert(typeof deepMerge({ a: 1, b: () => { } }, { a: 5, c: 10 }).b !== 'number');
  assert.deepEqual(deepMerge({ a: 1, b: () => { }, d: [1, 2, 3] }, { a: 5, c: 10, d: [1, 5, 6, 7] }).d, [1, 5, 6, 7]);
}

setTimeout(() => {
  testPrimitive();
  testMerge();
}, 1);
