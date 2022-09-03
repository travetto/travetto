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
  resolveEnvToken() {
    process.env.NAME = '0';
    assert.deepStrictEqual(SourceUtil.resolveToken('-$NAME'), {
      minus: true,
      key: 'NAME',
      valid: true
    });
    assert.deepStrictEqual(SourceUtil.resolveToken('$NAME'), {
      minus: false,
      key: 'NAME',
      valid: false
    });

    process.env.NAME = '1';
    assert.deepStrictEqual(SourceUtil.resolveToken('-$NAME'), {
      minus: true,
      key: 'NAME',
      valid: false
    });
    assert.deepStrictEqual(SourceUtil.resolveToken('$NAME'), {
      minus: false,
      key: 'NAME',
      valid: true
    });
  }

  @Test()
  resolveModToken() {
    const { err: __err1, ...rest } = SourceUtil.resolveToken('-fsa');
    assert.deepStrictEqual(rest, {
      minus: true,
      key: 'fsa',
      valid: true
    });

    const { err: __err2, ...rest2 } = SourceUtil.resolveToken('fsa');
    assert.deepStrictEqual(rest2, {
      minus: false,
      key: 'fsa',
      valid: false
    });

    const { err: __err3, ...rest3 } = SourceUtil.resolveToken('-fs');
    assert.deepStrictEqual(rest3, {
      minus: true,
      key: 'fs',
      valid: false
    });

    const { err: __err4, ...rest4 } = SourceUtil.resolveToken('fs');
    assert.deepStrictEqual(rest4, {
      minus: false,
      key: 'fs',
      valid: true
    });
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