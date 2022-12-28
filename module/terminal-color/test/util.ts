import assert from 'assert';

import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';

import { TerminalColorUtil } from '../src/util';

@Suite()
export class TerminalColorUtilTest {

  #env?: NodeJS.ProcessEnv;

  @BeforeEach()
  copy() {
    this.#env = process.env;
    process.env = {};
  }

  @AfterEach()
  restore() {
    if (this.#env) {
      process.env = this.#env;
      this.#env = undefined;
    }
  }

  @Test()
  verifyForceColor() {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = 'false';
    assert(TerminalColorUtil.detectColorLevel() === 0);

    for (const el of [0, 1, 2, 3]) {
      process.env.FORCE_COLOR = `${el}`;
      assert(TerminalColorUtil.detectColorLevel() === el);
    }

    process.env.FORCE_COLOR = 'true';
    assert(TerminalColorUtil.detectColorLevel() === 1);
  }

  @Test()
  verifyNoColor() {
    process.env.NO_COLOR = '0';
    assert(TerminalColorUtil.detectColorLevel() > 0);
    process.env.NO_COLOR = '1';
    assert(TerminalColorUtil.detectColorLevel() === 0);
  }

}