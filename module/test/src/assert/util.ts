import util from 'node:util';
import path from 'node:path';

import { asFull, type Class, JSONUtil, hasFunction, Runtime, RuntimeIndex, Util } from '@travetto/runtime';

import type { TestConfig, TestResult } from '../model/test.ts';
import type { SuiteConfig, SuiteResult } from '../model/suite.ts';

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
  static getPositionOfError(error: Error): { import: string, line: number } | undefined {
    const stack = error.stack ?? new Error().stack!;
    const frames = Util.stackTraceToParts(stack)
      .map(frame => {
        const imp = (RuntimeIndex.getFromSource(frame.filename) ?? RuntimeIndex.getEntry(frame.filename))?.import;
        return { ...frame, import: imp! };
      })
      .filter(frame => !!frame.import);

    return frames[0];
  }

  /**
   * Generate a suite error given a suite config, and an error
   */
  static generateSuiteTestFailure(config: { suite: SuiteConfig, test: TestConfig, error: Error, importLocation?: string }): TestResult {
    const { suite, test, error, importLocation } = config;
    const testImport = importLocation ?? test.import;
    const position = this.getPositionOfError(error);
    const line = position?.line ?? (testImport === suite.import ? suite.lineStart : 1);
    const testResult: TestResult = {
      ...suite.tests[test.methodName],
      suiteLineStart: suite.lineStart,
      status: 'errored',
      error,
      duration: 0,
      durationTotal: 0,
      output: [],
      assertions: [{
        import: position?.import ?? testImport,
        methodName: test.methodName,
        classId: suite.classId,
        operator: 'throw',
        error,
        line,
        message: error.message.split(/\n/)[0],
        text: test.methodName
      }],
    };

    return testResult;
  }

  /**
   * Generate suite failure
   */
  static generateSuiteTestFailures(suite: SuiteConfig, error: Error): TestResult[] {
    const finalError = error.cause instanceof Error ? error.cause : error;
    return Object.values(suite.tests).map(test => this.generateSuiteTestFailure({ suite, test, error: finalError }));
  }

  /**
   * Define import failure as a TestResult
   */
  static gernerateImportFailure(importLocation: string, error: Error): { result: TestResult, test: TestConfig, suite: SuiteResult & SuiteConfig } {
    const name = path.basename(importLocation);
    const classId = `${RuntimeIndex.getFromImport(importLocation)?.id}#${name}`;
    const suite = asFull<SuiteConfig & SuiteResult>({
      class: asFull<Class>({ name }), classId, duration: 0, lineStart: 1, lineEnd: 1, import: importLocation
    });
    error.message = error.message.replaceAll(Runtime.mainSourcePath, '.');
    const result = this.generateSuiteTestFailure({
      suite,
      test: {
        methodName: 'require',
        classId,
        import: importLocation,
        class: suite.class,
        lineBodyStart: 1,
        lineStart: 1,
        lineEnd: 1,
        skip: false
      },
      error
    });
    const test: TestConfig = {
      methodName: 'import',
      classId,
      import: importLocation,
      declarationImport: importLocation,
      lineStart: 0,
      lineEnd: 0,
      lineBodyStart: 0,
      tags: [],
      description: 'Import Failure',
      skip: false,
      class: undefined!
    };
    return { result, test, suite };
  }
}