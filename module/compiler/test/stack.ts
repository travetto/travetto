import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Stacktrace } from '@travetto/base';

@Suite()
class StackTest {

  @BeforeAll()
  beforeAll() {
    Stacktrace.initHandler();
  }

  @Test()
  async test() {
    const prom = new Promise((resolve, reject) => {
      setTimeout(function inner1() {
        setTimeout(function inner2() {
          setTimeout(function inner3() {
            reject(new Error('Uh oh'));
          }, 1);
        }, 1);
      }, 1);
    });
    try {
      await prom;
      assert(false);
    } catch (e) {
      assert(e);
      console.log(e);
    }
  }
}