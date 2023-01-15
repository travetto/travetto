import tty from 'tty';
import assert from 'assert';

import { Test, Suite, BeforeEach } from '@travetto/test';

import { TerminalUtil } from '../src/util';
import { Terminal } from '../src/terminal';

@Suite()
export class TerminalUtilTest {

  @BeforeEach()
  reset() {
    delete process.env.NO_COLOR;
    delete process.env.NODE_DISABLE_COLORS;
    delete process.env.FORCE_COLOR;
  }

  @Test()
  placeholder() {
    assert(true);
  }

  @Test()
  async verifyForceColor() {
    const term = new Terminal({ output: new tty.WriteStream(2), interactive: true });
    for (const el of [0, 1, 2, 3]) {
      process.env.FORCE_COLOR = `${el}`;
      assert(await TerminalUtil.detectColorLevel(term) === el);
    }

    process.env.FORCE_COLOR = 'true';
    assert(await TerminalUtil.detectColorLevel(term) === 1);
  }

  @Test()
  async verifyNoColor() {
    process.env.COLORTERM = 'truecolor';

    const term = new Terminal({ output: new tty.WriteStream(2), interactive: true });
    assert(await TerminalUtil.detectColorLevel(term) > 0);
    process.env.NO_COLOR = '1';
    assert(await TerminalUtil.detectColorLevel(term) === 0);
  }

}