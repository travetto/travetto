import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { TranspileUtil } from '../src/internal/transpile-util';

@Suite()
export class TranspileUtilTest {

  @Test()
  getErrorModule() {
    // message: string, isModule?: string | boolean, base?: Record<string, any>): string;
  }

  @Test()
  preProcess() {
    const results = TranspileUtil.preProcess('a', `import * as ts from 'typescript';
console.log('Hello');
`);
    assert(results.startsWith('// import'));
    assert(results.includes("log('info', {"));
    assert(results.endsWith("Object.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });"));
  }
}