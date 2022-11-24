import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ErrorUtil } from '../src/error-util';

@Suite()
class ErrorUtilTest {
  inner1() {
    throw new Error('Uh oh');
  }

  inner2() {
    return this.inner1();
  }

  async inner3() {
    return this.inner2();
  }

  async inner4() {
    return await this.inner3();
  }

  async inner5() {
    return new Promise(
      (res, rej) => setTimeout(() => this.inner4().then(res, rej), 1)
    );
  }

  async inner6() {
    return this.inner5();
  }

  @Test()
  async test() {
    try {
      await this.inner6();
      assert(false);
    } catch (err) {
      assert(err);
      assert(err instanceof Error);
      const stack = ErrorUtil.cleanStack(err);
      assert(!stack.includes('inner6'));
      assert(!stack.includes('inner5'));
      assert(stack.includes('inner4'));
      assert(stack.includes('inner3'));
      assert(stack.includes('inner2'));
      assert(stack.includes('inner1'));

      // assert(err?.stack === stack);
      console.warn('Error', { error: err });
    }
  }
}