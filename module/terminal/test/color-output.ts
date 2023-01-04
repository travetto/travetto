import tty from 'tty';
import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { Util } from '@travetto/base';

import { ColorOutputUtil } from '../src/color-output';

@Suite()
export class ColorOutputUtilTest {

  @Test()
  async verifyForceColor() {
    const stream = new tty.WriteStream(1);

    process.env.NO_COLOR = '1';
    delete process.env.FORCE_COLOR;
    assert(ColorOutputUtil.detectColorLevel(stream) === 0);
    delete process.env.NO_COLOR;

    for (const el of [0, 1, 2, 3]) {
      process.env.FORCE_COLOR = `${el}`;
      assert(ColorOutputUtil.detectColorLevel(stream) === el);
    }

    process.env.FORCE_COLOR = 'true';
    assert(ColorOutputUtil.detectColorLevel(stream) === 1);
  }

  @Test()
  async verifyNoColor() {
    process.env.COLORTERM = 'truecolor';
    delete process.env.NO_COLOR;
    delete process.env.NODE_DISABLE_COLORS;
    delete process.env.FORCE_COLOR;

    const stream = new tty.WriteStream(1);
    assert(ColorOutputUtil.detectColorLevel(stream) > 0);
    process.env.NO_COLOR = '1';
    assert(ColorOutputUtil.detectColorLevel(stream) === 0);
  }


  @Test()
  async colorize() {
    ColorOutputUtil.colorLevel = 1;
    const output = ColorOutputUtil.colorer({ text: 'red', underline: true })('apple');
    assert(output !== 'apple');
    assert(/apple/.test(output));
    assert(output.includes('\x1b[24;39m'));
    assert(output.includes('\x1b[91;4m'));
  }

  @Test()
  async noColor() {
    process.env.NO_COLOR = '1';
    delete process.env.FORCE_COLOR;

    ColorOutputUtil.colorLevel = undefined;
    assert(ColorOutputUtil.detectColorLevel(process.stdout) === 0);
    assert(ColorOutputUtil.colorLevel === 0);

    const tplFn = ColorOutputUtil.templateFunction({
      basic: { text: 'red', underline: true }
    });

    const tpl = Util.makeTemplate(tplFn);

    const output = tpl`${{ basic: 'apple' }}`;
    assert(output === 'apple');
    assert(!output.includes('\x1b['));
  }

  @Test()
  async template() {
    ColorOutputUtil.colorLevel = 1;
    const tplFn = ColorOutputUtil.templateFunction({
      name: '#0000ff',
      age: 'black'
    });

    const tpl = Util.makeTemplate(tplFn);

    const output = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(/My name is.*Bob.*and I'm.*20.*years old/.test(output));
    assert(output.includes('\x1b[39m'));
    assert(output.includes('\x1b[30m'));
    assert(output.includes('\x1b[94m'));

    ColorOutputUtil.colorLevel = 2;
    const output2 = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(output2.includes('\x1b[38;5;21m'));
    assert(output2.includes('\x1b[39m'));
    assert(!output2.includes('\x1b[94m'));

    ColorOutputUtil.colorLevel = 3;
    const output3 = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(output3.includes('\x1b[38;2;0;0;0m'));
    assert(output3.includes('\x1b[39m'));
    assert(!output3.includes('\x1b[94m'));
  }

  @Test({ shouldThrow: 'Invalid template' })
  badTemplate() {
    ColorOutputUtil.colorLevel = 1;
    const tplFn = ColorOutputUtil.templateFunction({
      name: 'blue',
      age: 'black'
    });

    const tpl = Util.makeTemplate(tplFn);

    tpl`My name is ${{ name: 'Bob', age: 20 }}`;
  }
}