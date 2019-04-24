import * as assert from 'assert';
import { Test, Suite } from '@travetto/test';

@Suite()
class StackTest {
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
      (res: any, rej) => setTimeout(() => this.inner4().then(res, rej), 1)
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
    } catch (e) {
      assert(!e.stack.includes('inner6'));
      assert(!e.stack.includes('inner5'));
      assert(e.stack.includes('inner4'));
      assert(e.stack.includes('inner3'));
      assert(e.stack.includes('inner2'));
      assert(e.stack.includes('inner1'));
      console.log(e);
    }
  }
}