import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { SourceUtil } from '../src/internal/source-util';

@Suite()
export class SourceUtilTest {

  @Test()
  getErrorModule() {
    // message: string, isModule?: string | boolean, base?: Record<string, any>): string;
  }

  @Test()
  preProcess() {
    SourceUtil.addPreProcessor((__, contents) =>
      contents.replace(/HELLO/g, x => 'HELLO; let __$$__ = 2'));
    const results = SourceUtil.preProcess('a', 'a\nb\nc\nHELLO');
    assert(results.includes('__$$__ = 2'));
    assert(results.includes('a\nb\nc\nHELLO'));
  }
}