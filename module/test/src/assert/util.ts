import util from 'node:util';
import path from 'node:path';

import { asFull, Class, hasFunction, Runtime, RuntimeIndex } from '@travetto/runtime';

import { TestConfig, Assertion, TestResult } from '../model/test';
import { SuiteConfig, SuiteFailure, SuiteResult } from '../model/suite';

const isCleanable = hasFunction<{ toClean(): unknown }>('toClean');

/**
 * Assertion utilities
 */
export class AssertUtil {
  /**
   * Clean a value for displaying in the output
   */
  static cleanValue(val: unknown): unknown {
    switch (typeof val) {
      case 'number': case 'boolean': case 'bigint': case 'string': case 'undefined': return val;
      case 'object': {
        if (isCleanable(val)) {
          return val.toClean();
        } else if (val === null || val.constructor === Object || Array.isArray(val) || val instanceof Date) {
          return JSON.stringify(val);
        }
        break;
      }
      case 'function': {
        if (val.Ⲑid || !val.constructor) {
          return val.name;
        }
        break;
      }
    }
    return util.inspect(val, false, 1).replace(/\n/g, ' ');
  }

  /**
   * Determine file location for a given error and the stack trace
   */
  static getPositionOfError(err: Error, imp: string): { import: string, line: number } {
    const cwd = Runtime.mainSourcePath;
    const lines = (err.stack ?? new Error().stack!)
      .replace(/[\\/]/g, '/')
      .split('\n')
      // Exclude node_modules, target self
      .filter(x => x.includes(cwd) && (!x.includes('node_modules') || x.includes('/support/')));

    const filename = RuntimeIndex.getFromImport(imp)?.sourceFile!;

    let best = lines.filter(x => x.includes(filename))[0];

    if (!best) {
      [best] = lines.filter(x => x.includes(`${cwd}/test`));
    }

    if (!best) {
      return { import: imp, line: 1 };
    }

    const pth = best.trim().split(/\s+/g).slice(1).pop()!;
    if (!pth) {
      return { import: imp, line: 1 };
    }

    const [file, lineNo] = pth
      .replace(/[()]/g, '')
      .replace(/^[A-Za-z]:/, '')
      .split(':');

    let line = parseInt(lineNo, 10);
    if (Number.isNaN(line)) {
      line = -1;
    }

    const outFileParts = file.split(cwd.replace(/^[A-Za-z]:/, ''));

    const outFile = outFileParts.length > 1 ? outFileParts[1].replace(/^[\/]/, '') : filename;

    const res = { import: RuntimeIndex.getFromSource(outFile)?.import!, line };

    return res;
  }

  /**
   * Generate a suite error given a suite config, and an error
   */
  static generateSuiteFailure(suite: SuiteConfig, methodName: string, error: Error): SuiteFailure {
    const { import: imp, ...pos } = this.getPositionOfError(error, suite.import);
    let line = pos.line;

    if (line === 1 && suite.lineStart) {
      line = suite.lineStart;
    }

    const msg = error.message.split(/\n/)[0];

    const core = { import: imp, classId: suite.classId, methodName };
    const coreAll = { ...core, description: msg, lineStart: line, lineEnd: line, lineBodyStart: line };

    const assert: Assertion = {
      ...core,
      operator: 'throw', error, line, message: msg, text: methodName
    };
    const testResult: TestResult = {
      ...coreAll,
      status: 'failed', error, duration: 0, durationTotal: 0, assertions: [assert], output: {}
    };
    const test: TestConfig = {
      ...coreAll,
      class: suite.class, skip: false
    };

    return { assert, testResult, test, suite };
  }

  /**
   * Define import failure as a SuiteFailure object
   */
  static gernerateImportFailure(imp: string, err: Error): SuiteFailure {
    const name = path.basename(imp);
    const classId = `${RuntimeIndex.getFromImport(imp)?.id}￮${name}`;
    const suite = asFull<SuiteConfig & SuiteResult>({
      class: asFull<Class>({ name }), classId, duration: 0, lineStart: 1, lineEnd: 1, import: imp
    });
    err.message = err.message.replaceAll(Runtime.mainSourcePath, '.');
    return this.generateSuiteFailure(suite, 'require', err);
  }
}