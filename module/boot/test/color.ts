import * as assert from 'assert';

import { Test, Suite, BeforeEach } from '@travetto/test';
import { ColorUtil } from '../src';

@Suite()
export class ColorUtilTest {
  @BeforeEach()
  init() {
    ColorUtil.colorize = true;
  }

  @Test()
  async colorize() {
    const output = ColorUtil.color('red', ['bold', 'underline'], 'apple');
    assert(output !== 'apple');
    assert(/apple/.test(output));
    assert(output.includes('\x1b[22'));
  }

  @Test()
  async noColor() {
    ColorUtil.colorize = false;
    const output = ColorUtil.color('red', ['bold', 'underline'], 'apple');
    assert(output === 'apple');
    assert(!output.includes('\x1b[22'));
  }

  @Test()
  async template() {
    const tpl = ColorUtil.makeTemplate({
      name: ColorUtil.makeColorer('blue', 'bold'),
      age: ColorUtil.makeColorer('red', 'faint')
    });

    const output = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(/My name is.*Bob.*and I'm.*20.*years old/.test(output));
    assert(output.includes('\x1b[22'));
  }

  @Test({ shouldThrow: 'Invalid template' })
  badTemplate() {
    const tpl = ColorUtil.makeTemplate({
      name: ColorUtil.makeColorer('blue', 'bold'),
      age: ColorUtil.makeColorer('red', 'faint')
    });

    tpl`My name is ${{ name: 'Bob', age: 20 }}`;
  }
}