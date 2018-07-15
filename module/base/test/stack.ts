import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

@Suite()
class StackTest {
  @Test()
  async test() {
    setTimeout(function inner1() {
      setTimeout(function inner2() {
        setTimeout(function inner3() {
          throw new Error('Uh oh');
        }, 1);
      }, 1);
    }, 1);
  }
}