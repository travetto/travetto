import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { ColorDefineUtil } from '../src/color-define';

@Suite()
export class ColorDefineTest {

  @Test()
  async define() {
    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('#ff0000')) === 91);
    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('#ff00ff')) === 95);

    assert(ColorDefineUtil.ansi256FromRgb(ColorDefineUtil.toRgb('#ff0000')) === 9);
    assert(ColorDefineUtil.ansi256FromRgb(ColorDefineUtil.toRgb('#ff00ff')) === 201);

    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('#555555')) === 90);
    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('#333333')) === 30);

    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('dimGray')) === 90);
    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('firebrick')) === 31);
    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('gold')) === 93);
    assert(ColorDefineUtil.ansi16FromRgb(ColorDefineUtil.toRgb('honeydew')) === 97);
  }

  @Test()
  async defineAll() {
    const defined = ColorDefineUtil.defineColor('gold');
    assert(defined.idx256 === 220);
    assert(defined.idx16 === 93);
    assert.deepStrictEqual(defined.rgb, [0xff, 0xd7, 0x00]);
  }
}