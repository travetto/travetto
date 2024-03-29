import util from 'node:util';

import { path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { Class, ClassInstance, ObjectUtil } from '@travetto/base';

import { TestConfig, Assertion, TestResult } from '../model/test';
import { SuiteConfig } from '../model/suite';

function isCleanable(o: unknown): o is { toClean(): unknown } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!o && !!(o as { toClean: unknown }).toClean;
}

/**
 * Assertion utilities
 */
export class AssertUtil {
  /**
   * Clean a value for displaying in the output
   */
  static cleanValue(val: unknown): unknown {
    if (isCleanable(val)) {
      return val.toClean();
    } else if (val === null || val === undefined
      || (!(val instanceof RegExp) && ObjectUtil.isPrimitive(val))
      || ObjectUtil.isPlainObject(val) || Array.isArray(val)
    ) {
      return JSON.stringify(val);
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const subV = val as (Class | ClassInstance);
      if (subV.Ⲑid || !subV.constructor || (!subV.constructor.Ⲑid && ObjectUtil.isFunction(subV))) { // If a function, show name
        return subV.name;
      } else { // Else inspect
        return util.inspect(val, false, 1).replace(/\n/g, ' ');
      }
    }
  }

  /**
   * Determine file location for a given error and the stack trace
   */
  static getPositionOfError(err: Error, filename: string): { file: string, line: number } {
    const cwd = RuntimeIndex.mainModule.sourcePath;
    const lines = path.toPosix(err.stack ?? new Error().stack!)
      .split('\n')
      // Exclude node_modules, target self
      .filter(x => x.includes(cwd) && (!x.includes('node_modules') || x.includes('/support/')));

    let best = lines.filter(x => x.includes(filename))[0];

    if (!best) {
      [best] = lines.filter(x => x.includes(`${cwd}/test`));
    }

    if (!best) {
      return { file: filename, line: 1 };
    }

    const pth = best.trim().split(/\s+/g).slice(1).pop()!;
    if (!pth) {
      return { file: filename, line: 1 };
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

    const res = { file: outFile, line };

    return res;
  }

  /**
   * Generate a suite error given a suite config, and an error
   */
  static generateSuiteError(suite: SuiteConfig, methodName: string, error: Error): { assert: Assertion, testResult: TestResult, testConfig: TestConfig } {
    const { file, ...pos } = this.getPositionOfError(error, suite.file);
    let line = pos.line;

    if (line === 1 && suite.lineStart) {
      line = suite.lineStart;
    }

    const msg = error.message.split(/\n/)[0];

    const core = { file, classId: suite.classId, methodName, module: RuntimeContext.main.name };
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