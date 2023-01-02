import tty from 'tty';
import assert from 'assert';

import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';
import { TerminalUtil } from '../src/util';

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
  async verifyForceColor() {
    const stream = new tty.WriteStream(1);

    process.env.NO_COLOR = '1';
    delete process.env.FORCE_COLOR;
    assert(TerminalUtil.detectColorLevel(stream) === 0);
    delete process.env.NO_COLOR;

    for (const el of [0, 1, 2, 3]) {
      process.env.FORCE_COLOR = `${el}`;
      assert(TerminalUtil.detectColorLevel(stream) === el);
    }

    process.env.FORCE_COLOR = 'true';
    assert(TerminalUtil.detectColorLevel(stream) === 1);
  }

  @Test()
  async verifyNoColor() {
    process.env.COLORTERM = 'truecolor';
    delete process.env.NO_COLOR;
    delete process.env.NODE_DISABLE_COLORS;
    delete process.env.FORCE_COLOR;

    const stream = new tty.WriteStream(1);
    assert(TerminalUtil.detectColorLevel(stream) > 0);
    process.env.NO_COLOR = '1';
    assert(TerminalUtil.detectColorLevel(stream) === 0);
  }

}