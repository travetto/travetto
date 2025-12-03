import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  #complexService: {
    doLongOperation(): Promise<number>;
    getText(): string;
  };

  @Test()
  async test1() {
    const value = await this.#complexService.doLongOperation();
    assert(value === 5);
  }

  @Test()
  test2() {
    const text = this.#complexService.getText();
    assert(/abc/.test(text));
  }
}