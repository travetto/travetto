import util from 'node:util';

import { Runtime, RuntimeIndex } from '@travetto/runtime';

import { TestConfig, Assertion, TestResult } from '../model/test';
import { SuiteConfig } from '../model/suite';

function isCleanable(o: unknown): o is { toClean(): unknown } {
  return !!o && typeof o === 'object' && 'toClean' in o && typeof o.toClean === 'function';
}

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
  static generateSuiteError(suite: SuiteConfig, methodName: string, error: Error): { assert: Assertion, testResult: TestResult, testConfig: TestConfig } {
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
    const testConfig: TestConfig = {
      ...coreAll,
      class: suite.class, skip: false
    };

    return { assert, testResult, testConfig };
  }
}