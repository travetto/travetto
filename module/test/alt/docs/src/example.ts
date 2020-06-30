import * as assert from 'assert';

import { Suite } from '../../../src/decorator/suite';
import { Test } from '../../../src/decorator/test';

@Suite()
class SimpleTest {

  private complexService: any;

  @Test()
  async test1() {
    const val = await this.complexService.doLongOp();
    assert(val === 5);
  }

  @Test()
  test2() {
    const text = this.complexService.getText();
    assert(/abc/.test(text));
  }
}