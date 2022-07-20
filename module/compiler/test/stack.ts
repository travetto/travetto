import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

@Suite()
class StackTest {

  inner3() {
    throw new Error('uh oh');
  }

  async inner2() {
    return await this.inner3();
  }

  async inner1() {
    return this.inner2();
  }

  @Test()
  async test() {
    try {
      await this.inner1();
      assert(false);
    } catch (err) {
      assert(err.stack.includes('inner1'));
      assert(err.stack.includes('inner2'));
      assert(err.stack.includes('inner3'));
      console.error('Error', { error: err });
    }
  }
}