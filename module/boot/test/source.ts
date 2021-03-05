import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { SourceUtil } from '../src/internal/source';

const FILE_IF = '@file-if';

@Suite()
export class SourceUtilTest {

  @Test()
  getErrorModule() {
    // message: string, isModule?: string | boolean, base?: Record<string, any>): string;
  }

  @Test()
  resolveEnvToken() {
    process.env.NAME = '0';
    assert(SourceUtil.resolveToken('-$NAME') === {
      minus: true,
      key: 'NAME',
      valid: true
    });
    assert(SourceUtil.resolveToken('$NAME') === {
      minus: false,
      key: 'NAME',
      valid: false
    });

    process.env.NAME = '1';
    assert(SourceUtil.resolveToken('-$NAME') === {
      minus: true,
      key: 'NAME',
      valid: false
    });
    assert(SourceUtil.resolveToken('$NAME') === {
      minus: false,
      key: 'NAME',
      valid: true
    });
  }

  @Test()
  resolveModToken() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { err, ...rest } = SourceUtil.resolveToken('-fsa');
    assert(rest === {
      minus: true,
      key: 'fsa',
      valid: true
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { err: err2, ...rest2 } = SourceUtil.resolveToken('fsa');
    assert(rest2 === {
      minus: false,
      key: 'fsa',
      valid: false
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { err: err3, ...rest3 } = SourceUtil.resolveToken('-fs');
    assert(rest3 === {
      minus: true,
      key: 'fs',
      valid: false
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { err: err4, ...rest4 } = SourceUtil.resolveToken('fs');
    assert(rest4 === {
      minus: false,
      key: 'fs',
      valid: true
    });
  }

  @Test()
  resolveMacros() {
    const { contents: resolved } = SourceUtil.resolveMacros(`
let fs   = 'test'; // @line-if fs 
let fsn  = 'test'; // @line-if -fs 
let fsa  = 'test'; // @line-if fsa
let fsan = 'test'; // @line-if -fsa
    `);

    assert(resolved.includes('let fs '));
    assert(!resolved.includes('let fsn '));
    assert(!resolved.includes('let fsa '));
    assert(resolved.includes('let fsan '));

    const { contents: resolvedFile } = SourceUtil.resolveMacros(`
// ${FILE_IF} fs
// ${FILE_IF} -fsa    
let fs   = 'test'; // @line-if fs 
let fsan = 'test'; // @line-if -fsa
    `);

    assert(resolvedFile.includes('let fs '));
    assert(resolvedFile.includes('let fsan '));

    const { contents: resolvedFileNeg } = SourceUtil.resolveMacros(`
// ${FILE_IF} -fs
let fs   = 'test'; // @line-if fs 
let fsan = 'test'; // @line-if -fsa
        `);

    assert(!resolvedFileNeg.includes('let fs '));
    assert(!resolvedFileNeg.includes('let fsan '));
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