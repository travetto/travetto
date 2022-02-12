import * as assert from 'assert';

import { PathUtil } from '@travetto/boot';
import { Util, AppError, ClassInstance, Class } from '@travetto/base';

import { ThrowableError, TestConfig } from '../model/test';
import { AssertCapture, CaptureAssert } from './capture';
import { AssertUtil } from './util';
import { ASSERT_FN_OPERATOR, OP_MAPPING } from './types';

declare module 'assert' {
  interface AssertionError {
    toJSON(): Record<string, unknown>;
  }
}

/**
 * Check assertion
 */
export class AssertCheck {
  /**
   * Check a given assertion
   * @param assertion The basic assertion information
   * @param positive Is the check positive or negative
   * @param args The arguments passed in
   */
  static check(assertion: CaptureAssert, positive: boolean, ...args: unknown[]) {
    let fn = assertion.operator;
    assertion.operator = ASSERT_FN_OPERATOR[fn];

    // Determine text based on positivity
    const common: Record<string, string> = {
      state: positive ? 'should' : 'should not'
    };

    // Invert check for negative
    const assertFn = positive ? assert : (x: unknown, msg?: string) => assert(!x, msg);

    // Check fn to call
    if (fn === 'fail') {
      if (args.length > 1) {
        [assertion.actual, assertion.expected, assertion.message, assertion.operator] = args as [unknown, unknown, string, string];
      } else {
        [assertion.message] = args as [string];
      }
    } else if (/throw|reject/i.test(fn)) {
      assertion.operator = fn;
      if (typeof args[1] !== 'string') {
        [, assertion.expected, assertion.message] = args as [unknown, unknown, string];
      } else {
        [, assertion.message] = args as [unknown, string];
      }
    } else if (fn === 'ok' || fn === 'assert') {
      fn = assertion.operator = 'ok';
      [assertion.actual, assertion.message] = args as [unknown, string];
      assertion.expected = { toClean: () => positive ? 'truthy' : 'falsy' };
      common.state = 'should be';
    } else if (fn === 'includes') {
      assertion.operator = fn;
      [assertion.expected, assertion.actual, assertion.message] = args as [unknown, unknown, string];
    } else if (fn === 'instanceof') {
      assertion.operator = fn;
      [assertion.actual, assertion.expected, assertion.message] = args as [unknown, unknown, string];
      assertion.actual = (assertion.actual as ClassInstance)?.constructor;
    } else { // Handle unknown
      assertion.operator = fn ?? '';
      [assertion.actual, assertion.expected, assertion.message] = args as [unknown, unknown, string];
    }

    try {
      // Clean actual/expected
      if (assertion.actual !== undefined) {
        assertion.actual = AssertUtil.cleanValue(assertion.actual);
      }

      if (assertion.expected !== undefined) {
        assertion.expected = AssertUtil.cleanValue(assertion.expected);
      }

      const [actual, expected, message] = args as [unknown, unknown, string];

      // Actually run the assertion
      switch (fn) {
        case 'instanceof': assertFn(actual instanceof (expected as Class), message); break;
        case 'in': assertFn((actual as string) in (expected as object), message); break;
        case 'lessThan': assertFn((actual as number) < (expected as number), message); break;
        case 'lessThanEqual': assertFn((actual as number) <= (expected as number), message); break;
        case 'greaterThan': assertFn((actual as number) > (expected as number), message); break;
        case 'greaterThanEqual': assertFn((actual as number) >= (expected as number), message); break;
        case 'ok': assertFn.apply(null, args as [unknown, string]); break; // eslint-disable-line prefer-spread
        default:
          if (fn && assert[fn as keyof typeof assert]) { // Assert call
            if (/not/i.test(fn)) {
              common.state = 'should not';
            }
            assert[fn as 'ok'].apply(null, args as [boolean, string | undefined]);
          } else if (expected && !!(expected as Record<string, Function>)[fn]) { // Dotted Method call (e.g. assert.rejects)
            assertFn((expected as typeof assert)[fn as 'ok'](actual));
          }
      }

      // Pushing on not error
      AssertCapture.add(assertion);
    } catch (e) {
      // On error, produce the appropriate error message
      if (e instanceof assert.AssertionError) {
        if (!assertion.message) {
          assertion.message = (OP_MAPPING[fn] ?? '{state} be {expected}');
        }
        assertion.message = assertion.message
          .replace(/[{]([A-Za-z]+)[}]/g, (a, k) => common[k] || assertion[k as keyof typeof assertion] as string)
          .replace(/not not/g, ''); // Handle double negatives
        assertion.error = e;
        e.message = assertion.message;
        AssertCapture.add(assertion);
      }
      throw e;
    }
  }

  /**
   * Check a given error
   * @param shouldThrow  Should the test throw anything
   * @param err The provided error
   */
  static checkError(shouldThrow: ThrowableError | undefined, err: Error | string | undefined): Error | undefined {
    if (!shouldThrow) { // If we shouldn't be throwing anything, we are good
      return;
    }
    // If should throw is a string or a regexp
    if (typeof shouldThrow === 'string' || shouldThrow instanceof RegExp) {
      const actual = `${err instanceof Error ? `'${err.message}'` : (err ? `'${err}'` : 'nothing')}`;

      // If a string, check if error exists, and then see if the string is included in the message
      if (typeof shouldThrow === 'string' && (!err || !(err instanceof Error ? err.message : err).includes(shouldThrow))) {
        return new assert.AssertionError({ message: `Expected error containing text '${shouldThrow}', but got ${actual}` });
      }
      // If a regexp, check if error exists, and then test the error message against the regex
      if (shouldThrow instanceof RegExp && (!err || !shouldThrow.test(typeof err === 'string' ? err : err.message))) {
        return new assert.AssertionError({ message: `Expected error with message matching '${shouldThrow.source}', but got ${actual} ` });
      }
      // If passing in a constructor
    } else if (shouldThrow === Error ||
      shouldThrow === AppError ||
      Object.getPrototypeOf(shouldThrow) !== Object.getPrototypeOf(Function)
    ) { // if not simple function, treat as class
      if (!err || !(err instanceof shouldThrow)) {
        return new assert.AssertionError({ message: `Expected to throw ${shouldThrow.name}, but got ${err ?? 'nothing'} ` });
      }
    } else {
      // Else treat as a simple function to build an error or not
      const res = shouldThrow(err);
      if (res && !(res instanceof Error)) {
        return new AppError(`Invalid check, "${shouldThrow.name}" should return an Error or undefined`, 'data');
      } else {
        return res;
      }
    }
  }

  /**
   * Check the throw, doesNotThrow behavior of an assertion
   * @param assertion The basic assertion information
   * @param positive Is the test positive or negative
   * @param action Function to run
   * @param shouldThrow Should this action throw
   * @param message Message to share on failure
   */
  static checkThrow(assertion: CaptureAssert, positive: boolean, action: Function, shouldThrow?: ThrowableError, message?: string) {
    let missed: Error | undefined;

    try {
      action();
      if (!positive) {
        if (!Util.isPrimitive(shouldThrow)) {
          shouldThrow = shouldThrow?.name;
        }
        throw (missed = new AppError(`No error thrown, but expected ${shouldThrow ?? 'an error'}`));
      }
    } catch (e) {
      if (positive) {
        missed = new AppError('Error thrown, but expected no errors');
        missed.stack = e.stack;
      }

      e = (missed && e) || this.checkError(shouldThrow, e);
      if (e) {
        assertion.message = message || missed?.message || e.message;
        throw (assertion.error = e);
      }
    } finally {
      AssertCapture.add(assertion);
    }
  }

  /**
   * Check the rejects, doesNotReject behavior of an assertion
   * @param assertion Basic assertion information
   * @param positive Is the test positive or negative
   * @param action Async function to run
   * @param shouldThrow Should this action reject
   * @param message Message to share on failure
   */
  static async checkThrowAsync(assertion: CaptureAssert, positive: boolean, action: Function | Promise<unknown>, shouldThrow?: ThrowableError, message?: string) {
    let missed: Error | undefined;

    try {
      if ('then' in action) {
        await action;
      } else {
        await action();
      }
      if (!positive) {
        if (!Util.isPrimitive(shouldThrow)) {
          shouldThrow = shouldThrow?.name;
        }
        throw (missed = new AppError(`No error thrown, but expected ${shouldThrow ?? 'an error'} `));
      }
    } catch (e) {
      if (positive) {
        missed = new AppError('Error thrown, but expected no errors');
      }

      e = (missed && e) || this.checkError(shouldThrow, e);
      if (e) {
        assertion.message = message || missed?.message || e.message;
        throw (assertion.error = e);
      }
    } finally {
      AssertCapture.add(assertion);
    }
  }

  /**
   * Look for any unhandled exceptions
   */
  static checkUnhandled(test: TestConfig, err: Error | assert.AssertionError) {
    let line = AssertUtil.getPositionOfError(err, test.file).line;
    if (line === 1) {
      line = test.lines.start;
    }

    AssertCapture.add({
      file: test.file.replace(`${PathUtil.cwd}/`, ''),
      line,
      operator: 'throws',
      error: err,
      message: err.message,
      text: ('operator' in err ? err.operator : '') || '(uncaught)'
    });
  }
}