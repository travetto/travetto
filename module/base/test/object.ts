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

    async function* gen() {
      yield 5;
    }

    assert(ObjectUtil.isFunction(test));
    assert(ObjectUtil.isSimple(test));
    assert(ObjectUtil.isFunction(gen));
  }

  @Test()
  verifyObject() {
    assert(ObjectUtil.isPlainObject({}));
    assert(ObjectUtil.isPlainObject(Object.create({})));
    assert(ObjectUtil.isPlainObject(Object.create(null)) !== true);
    assert(ObjectUtil.isPlainObject(Object.create(Function)) !== true);
    assert(ObjectUtil.isPlainObject(new class { }()) !== true);
  }

  @Test()
  verifyClass() {
    assert(ObjectUtil.isClass(class { }));
    assert(ObjectUtil.isClass(Function) === false);
    assert(ObjectUtil.isClass(new class { }()) === false);
  }

  @Test()
  verifyPrimitive() {
    assert(ObjectUtil.isPrimitive(5));
    // eslint-disable-next-line no-new-wrappers
    assert(ObjectUtil.isPrimitive(new String('5')));
    assert(ObjectUtil.isPrimitive(String('5')));
    assert(ObjectUtil.isPrimitive('5'));
    // eslint-disable-next-line no-new-wrappers
    assert(ObjectUtil.isPrimitive(new Number(5)));
    assert(ObjectUtil.isPrimitive(Number(5)));

    assert(ObjectUtil.isPrimitive(false));
    // eslint-disable-next-line no-new-wrappers
    assert(ObjectUtil.isPrimitive(new Boolean('true')));
    assert(ObjectUtil.isPrimitive(Boolean('false')));

    assert(ObjectUtil.isPrimitive(new Date()));
    assert(ObjectUtil.isPrimitive(/./));
    assert(ObjectUtil.isPrimitive(new RegExp('.')));
    assert(!ObjectUtil.isPrimitive(Function));
    assert(!ObjectUtil.isPrimitive(class { }));
    assert(!ObjectUtil.isPrimitive(new class { }()));
  }

  @Test()
  verifySimple() {
    assert(ObjectUtil.isSimple(5));
    assert(ObjectUtil.isSimple(Number(5)));
    assert(ObjectUtil.isSimple(Boolean(5)));
    assert(ObjectUtil.isSimple(Function));
    assert(ObjectUtil.isSimple(() => { }));
    assert(ObjectUtil.isSimple(class { }));
    assert(!ObjectUtil.isSimple(new class { }()));
  }
}
