import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { ColorSupport } from '../src/color';
import { ColorUtil } from '../src/color-support/util';
import { COLOR_NAMES } from '../src/color-support/names';

@Suite()
export class ColorUtilTest {

  @Test()
  async colorize() {
    const output = new ColorSupport(COLOR_NAMES, 1).colorer({ text: 'red', underline: true })('apple');
    assert(output !== 'apple');
    assert(/apple/.test(output));
    assert(output.includes('\x1b[24m'));
    assert(output.includes('\x1b[4m'));
  }

  @Test()
  async noColor() {
    process.env.NO_COLOR = '1';
    assert(ColorUtil.detectLevel() === 0);

    const tpl = new ColorSupport(COLOR_NAMES).template({
      basic: { text: 'red', underline: true }
    });

    const output = tpl`${{ basic: 'apple' }}`;
    assert(output === 'apple');
    assert(!output.includes('\x1b['));
  }

  @Test()
  async template() {
    const tpl = new ColorSupport(COLOR_NAMES, 1).template({
      name: 'blue',
      age: 'black'
    });

    const output = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(/My name is.*Bob.*and I'm.*20.*years old/.test(output));
    assert(output.includes('\x1b[24m'));
  }

  @Test({ shouldThrow: 'Invalid template' })
  badTemplate() {
    const tpl = new ColorSupport(COLOR_NAMES, 1).template({
      name: 'blue',
      age: 'black'
    });

    tpl`My name is ${{ name: 'Bob', age: 20 }}`;
  }
}