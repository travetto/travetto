import { Suite, Test, BeforeAll } from '@travetto/test';
import { Stacktrace } from '@travetto/base/src/stacktrace';

@Suite()
class StackTest {

  @BeforeAll()
  beforeAll() {
    Stacktrace.initHandler();
  }

  @Test()
  async try() {
    setTimeout(function inner1() {
      setTimeout(function inner2() {
        setTimeout(function inner3() {
          throw new Error('Uh ohs');
        }, 1);
      }, 1);
    }, 1);
  }
}