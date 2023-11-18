import { Test, Suite } from '@travetto/test';

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
  doNothing() {

  }
}