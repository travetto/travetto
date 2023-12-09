import tty from 'node:tty';
import assert from 'node:assert';

import { Test, Suite, BeforeEach } from '@travetto/test';
import { Env, Util } from '@travetto/base';

import { ColorOutputUtil } from '../src/color-output';
import { Terminal } from '../src/terminal';

@Suite()
export class ColorOutputUtilTest {

  @BeforeEach()
  reset() {
    Env.NO_COLOR.clear();
    Env.NODE_DISABLE_COLORS.clear();
    Env.FORCE_COLOR.clear();
  }

  @Test()
  async colorize() {
    const term = new Terminal({ output: new tty.WriteStream(2), colorLevel: 1 });

    const output = ColorOutputUtil.colorer(term, { text: 'red', underline: true })('apple');
    assert(output !== 'apple');
    assert(/apple.*39m/.test(output));
    assert(output.includes('\x1b[24;39m'));
    assert(output.includes('\x1b[91;4m'));
  }

  @Test()
  async noColor() {
    Env.NO_COLOR.set(true);

    const term = new Terminal({ output: new tty.WriteStream(2) });
    assert(term.colorLevel === 0);

    const tplFn = term.templateFunction({
      basic: { text: 'red', underline: true }
    });

    const tpl = Util.makeTemplate(tplFn);

    const output = tpl`${{ basic: 'apple' }}`;
    assert(output === 'apple');
    assert(!output.includes('\x1b['));
  }

  @Test()
  async template() {
    const term = new Terminal({ output: new tty.WriteStream(2), colorLevel: 1 });

    const palette = {
      name: '#0000ff',
      age: 'black'
    } as const;

    const tpl = Util.makeTemplate(term.templateFunction(palette));
    const output = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(/My name is.*Bob.*and I'm.*20.*years old/.test(output));
    assert(output.includes('\x1b[39m'));
    assert(output.includes('\x1b[30m'));
    assert(output.includes('\x1b[94m'));

    const term2 = new Terminal({ output: new tty.WriteStream(2), colorLevel: 2 });
    const tpl2 = Util.makeTemplate(term2.templateFunction(palette));

    const output2 = tpl2`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(output2.includes('\x1b[38;5;21m'));
    assert(output2.includes('\x1b[39m'));
    assert(!output2.includes('\x1b[94m'));

    const term3 = new Terminal({ output: new tty.WriteStream(2), colorLevel: 3 });
    const tpl3 = Util.makeTemplate(term3.templateFunction(palette));
    const output3 = tpl3`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(output3.includes('\x1b[38;2;0;0;0m'));
    assert(output3.includes('\x1b[39m'));
    assert(!output3.includes('\x1b[94m'));
  }

  @Test({ shouldThrow: 'Invalid template' })
  badTemplate() {
    const term = new Terminal({ output: new tty.WriteStream(2), colorLevel: 1 });
    const tpl = Util.makeTemplate(term.templateFunction({
      name: 'blue',
      age: 'black'
    }));

    tpl`My name is ${{ name: 'Bob', age: 20 }}`;
  }

  @Test()
  async verifyForceColor() {
    const output = new tty.WriteStream(2);

    for (const el of [0, 1, 2, 3] as const) {
      Env.FORCE_COLOR.set(el);
      assert(await ColorOutputUtil.readTermColorLevel(output) === el);
    }

    Env.FORCE_COLOR.set(true);
    assert(await ColorOutputUtil.readTermColorLevel(output) === 1);
  }

  @Test()
  async verifyNoColor() {
    Env.COLORTERM.set('truecolor');

    const output = new tty.WriteStream(2);

    assert(await ColorOutputUtil.readTermColorLevel(output) > 0);
    Env.NO_COLOR.set(true);
    assert(await ColorOutputUtil.readTermColorLevel(output) === 0);
  }
}