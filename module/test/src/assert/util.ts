import util from 'node:util';
import path from 'node:path';

import { asFull, type Class, JSONUtil, hasFunction, Runtime, RuntimeIndex, Util } from '@travetto/runtime';

import type { TestResult } from '../model/test.ts';
import type { SuiteConfig, SuiteFailure, SuiteResult } from '../model/suite.ts';

const isCleanable = hasFunction<{ toClean(): unknown }>('toClean');

/**
 * Assertion utilities
 */
export class AssertUtil {
  /**
   * Clean a value for displaying in the output
   */
  static cleanValue(value: unknown): unknown {
    switch (typeof value) {
      case 'number': case 'boolean': case 'bigint': case 'string': case 'undefined': return value;
      case 'object': {
        if (isCleanable(value)) {
          return value.toClean();
        } else if (value === null || value.constructor === Object || Array.isArray(value) || value instanceof Date) {
          return JSONUtil.toUTF8(value);
        }
        break;
      }
      case 'function': {
        if (value.Ⲑid || !value.constructor) {
          return value.name;
        }
        break;
      }
    }
    return util.inspect(value, false, 1).replace(/\n/g, ' ');
  }

  /**
   * Determine file location for a given error and the stack trace
   */
  static getPositionOfError(error: Error, importLocation: string): { import: string, line?: number } {
    const stack = error.stack ?? new Error().stack!;
    const frames = Util.stackTraceToParts(stack)
      .map(frame => {
        const imp = (RuntimeIndex.getFromSource(frame.filename) ?? RuntimeIndex.getEntry(frame.filename))?.import;
        return { ...frame, import: imp! };
      })
      .filter(frame => !!frame.import);

    return frames[0] ?? { import: importLocation };
  }

  /**
   * Generate a suite error given a suite config, and an error
   */
  static generateSuiteTestFailure(config: { suite: SuiteConfig, methodName: string, error: Error, importLocation: string }): TestResult {
    const { suite, methodName, error, importLocation } = config;
    const { import: assertImport, line } = this.getPositionOfError(error, importLocation);
    const testResult: TestResult = {
      ...suite.tests[methodName],
      suiteLineStart: suite.lineStart,
      status: 'failed',
      error,
      duration: 0,
      durationTotal: 0,
      output: [],
      assertions: [{
        import: assertImport,
        methodName,
        classId: suite.classId,
        operator: 'throw',
        error,
        line: line ?? (assertImport === suite.import ? suite.lineStart : 1),
        message: error.message.split(/\n/)[0],
        text: methodName
      }],
    };

    return testResult;
  }

  /**
   * Generate suite failure
   */
  static generateSuiteFailure(suite: SuiteConfig, error: Error): SuiteFailure {
    return {
      suite, testResults: Object.values(suite.tests).map(test =>
        this.generateSuiteTestFailure({
          suite,
          methodName: test.methodName,
          error: error.cause instanceof Error ? error.cause : error,
          importLocation: 'import' in error && typeof error.import === 'string' ? error.import : suite.import
        })
      )
    };
  }

  /**
   * Define import failure as a SuiteFailure object
   */
  static gernerateImportFailure(importLocation: string, error: Error): SuiteFailure {
    const name = path.basename(importLocation);
    const classId = `${RuntimeIndex.getFromImport(importLocation)?.id}#${name}`;
    const suite = asFull<SuiteConfig & SuiteResult>({
      class: asFull<Class>({ name }), classId, duration: 0, lineStart: 1, lineEnd: 1, import: importLocation
    });
    error.message = error.message.replaceAll(Runtime.mainSourcePath, '.');
    return { suite, testResults: [this.generateSuiteTestFailure({ suite, methodName: 'require', error, importLocation: suite.import })] };
  }
}