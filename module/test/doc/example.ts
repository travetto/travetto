import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  #complexService: {
    doLongOp(): Promise<number>;
    getText(): string;
  };

  @Test()
  async test1() {
    const value = await this.#complexService.doLongOp();
    assert(value === 5);
  }

  @Test()
  test2() {
    const text = this.#complexService.getText();
    assert(/abc/.test(text));
  }
}