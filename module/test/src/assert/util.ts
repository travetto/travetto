import util from 'node:util';

import { JSONUtil, hasFunction, RuntimeIndex, Util } from '@travetto/runtime';

import type { Assertion, TestConfig } from '../model/test.ts';
import type { SuiteConfig } from '../model/suite.ts';

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
    const frames = Util.stackTraceToParts(error.stack ?? new Error().stack!)
      .map(frame => {
        const entry = RuntimeIndex.getEntry(frame.filename);
        return { ...frame, import: entry?.import!, line: entry?.type === 'ts' ? frame.line : 1 };
      });

    return frames.find(frame => frame.import);
  }

  /**
   * Generate a suite error given a suite config, and an error
   */
  static generateAssertion(config: { suite: SuiteConfig, test: TestConfig, error: Error, importLocation?: string }): Assertion {
    const { suite, test, error: errorValue, importLocation } = config;
    const error = (errorValue.cause && errorValue.cause instanceof Error) ? errorValue.cause : errorValue;
    const testImport = importLocation ?? test.import;
    const position = this.getPositionOfError(error);
    const line = position?.line ?? (testImport === suite.import ? suite.lineStart : 1);
    return {
      import: position?.import ?? testImport,
      methodName: test.methodName,
      classId: suite.classId,
      operator: 'throw',
      error,
      line,
      message: error.message.split(/\n/)[0],
      text: test.methodName
    };
  }
}