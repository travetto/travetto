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
    const results = SourceUtil.preProcess('a', `import * as ts from 'typescript';
console.log('Hello');
`);
    assert(results.startsWith('// import'));
    assert(results.includes("log('info', {"));
    assert(results.endsWith("Object.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });"));
  }
}