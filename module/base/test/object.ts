import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { ObjectUtil } from '../src/object';

class Test2 { }

@Suite()
export class ObjectUtilSuite {
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
  verifyFunction() {
    async function test() {
      // Do nothing
    }

    assert(ObjectUtil.isFunction(test));
    assert(ObjectUtil.isSimple(test));
  }
}