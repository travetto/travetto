import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  #complexService: {
    doLongOp(): Promise<number>;
    getText(): string;
  };

  @Test()
  async test1() {
    const val = await this.#complexService.doLongOp();
    assert(val === 5);
  }

  @Test()
  test2() {
    const text = this.#complexService.getText();
    assert(/abc/.test(text));
  }
}