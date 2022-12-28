import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { TerminalColorSupport } from '../src/support';

@Suite()
export class ColorUtilTest {

  @Test()
  async colorize() {
    const output = new TerminalColorSupport().setLevel(1).colorer({ text: 'red', underline: true })('apple');
    assert(output !== 'apple');
    assert(/apple/.test(output));
    assert(output.includes('\x1b[24;39m'));
    assert(output.includes('\x1b[91;4m'));
  }

  @Test()
  async noColor() {
    process.env.NO_COLOR = '1';
    const tpl = new TerminalColorSupport().template({
      basic: { text: 'red', underline: true }
    });

    const output = tpl`${{ basic: 'apple' }}`;
    assert(output === 'apple');
    assert(!output.includes('\x1b['));
  }

  @Test()
  async template() {
    const sup = new TerminalColorSupport().setLevel(1);
    const tpl = sup.template({
      name: '#0000ff',
      age: 'black'
    });

    const output = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(/My name is.*Bob.*and I'm.*20.*years old/.test(output));
    assert(output.includes('\x1b[39m'));
    assert(output.includes('\x1b[30m'));
    assert(output.includes('\x1b[94m'));

    sup.setLevel(2);
    const output2 = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(output2.includes('\x1b[38;5;21m'));
    assert(output2.includes('\x1b[39m'));
    assert(!output2.includes('\x1b[94m'));

    sup.setLevel(3);
    const output3 = tpl`My name is ${{ name: 'Bob' }} and I'm ${{ age: 20 }} years old`;
    assert(output3.includes('\x1b[38;2;0;0;0m'));
    assert(output3.includes('\x1b[39m'));
    assert(!output3.includes('\x1b[94m'));
  }

  @Test({ shouldThrow: 'Invalid template' })
  badTemplate() {
    const tpl = new TerminalColorSupport().setLevel(1).template({
      name: 'blue',
      age: 'black'
    });

    tpl`My name is ${{ name: 'Bob', age: 20 }}`;
  }
}