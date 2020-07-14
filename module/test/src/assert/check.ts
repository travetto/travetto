/// <reference path="error.d.ts" />

import * as assert from 'assert';

import { FsUtil } from '@travetto/boot';
import { Util, AppError } from '@travetto/base';

import { ThrowableError, TestConfig } from '../model/test';
import { AssertCapture, CaptureAssert } from './capture';
import { AssertUtil } from './util';
import { ASSERT_FN_OPERATOR, OP_MAPPING } from './types';

const { AssertionError } = assert;

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
  static check(assertion: CaptureAssert, positive: boolean, ...args: any[]) {
    let fn = assertion.operator;
    assertion.operator = ASSERT_FN_OPERATOR[fn];

    // Determine text based on positivity
    const common: Record<string, string> = {
      state: positive ? 'should' : 'should not'
    };

    // Invert check for negative
    const asrt = positive ? assert : (x: any, msg?: string) => assert(!x, msg);

    // Check fn to call
    if (fn === 'fail') {
      if (args.length > 1) {
        assertion.actual = args[0];
        assertion.expected = args[1];
        assertion.message = args[2];
        assertion.operator = args[3];
      } else {
        assertion.message = args[0];
      }
    } else if (/throw|reject/i.test(fn)) {
      assertion.operator = fn;
      if (typeof args[1] !== 'string') {
        assertion.expected = args[1];
        assertion.message = args[2];
      } else {
        assertion.message = args[1];
      }
    } else if (fn === 'ok' || fn === 'assert') {
      assertion.actual = args[0];
      assertion.message = args[1];
      assertion.expected = { toClean: () => positive ? 'truthy' : 'falsy' };
      common.state = 'should be';
      fn = assertion.operator = 'ok';
    } else if (fn === 'includes') {
      assertion.operator = fn;
      assertion.message = args[2];
      assertion.expected = args[0];
      assertion.actual = args[1];
    } else if (fn === 'instanceof') {
      assertion.expected = args[1];
      assertion.actual = (args[0] === null || args[0] === undefined) ? args[0] : args[0].constructor;
      assertion.message = args[2];
      assertion.operator = fn;
    } else { // Handle unknown
      assertion.operator = fn ?? '';
      assertion.message = args[2];
      assertion.expected = args[1];
      assertion.actual = args[0];
    }

    try {
      // Clean actual/expected
      if (assertion.actual !== undefined) {
        assertion.actual = AssertUtil.cleanValue(assertion.actual);
      }

      if (assertion.expected !== undefined) {
        assertion.expected = AssertUtil.cleanValue(assertion.expected);
      }

      // Actually run the assertion
      switch (fn) {
        case 'instanceof': asrt(args[0] instanceof args[1], args[2]); break;
        case 'in': asrt(args[0] in args[1], args[2]); break;
        case 'lessThan': asrt(args[0] < args[1], args[2]); break;
        case 'lessThanEqual': asrt(args[0] <= args[1], args[2]); break;
        case 'greaterThan': asrt(args[0] > args[1], args[2]); break;
        case 'greaterThanEqual': asrt(args[0] >= args[1], args[2]); break;
        case 'ok': asrt.apply(null, args as [any, string]); break; // eslint-disable-line prefer-spread
        default:
          if (fn && assert[fn as keyof typeof assert]) { // Assert call
            if (/not/i.test(fn)) {
              common.state = 'should not';
            }
            // @ts-ignore
            assert[fn].apply(null, args);
          } else if (args[1] && fn && args[1][fn]) { // Method call
            asrt(args[1][fn](args[0]));
          }
      }

      // Pushing on not error
      AssertCapture.add(assertion);
    } catch (e) {
      // On error, produce the appropriate error message
      if (e instanceof AssertionError) {
        if (!assertion.message) {
          assertion.message = (OP_MAPPING[fn] ?? `{state} be {expected}`);
        }
        assertion.message = assertion.message
          .replace(/[{]([A-Za-z]+)[}]/g, (a, k) => common[k] || assertion[k as keyof typeof assertion])
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
        return new AssertionError({ message: `Expected error containing text '${shouldThrow}', but got ${actual}` });
      }
      // If a regexp, check if error exists, and then test the error message against the regex
      if (shouldThrow instanceof RegExp && (!err || !shouldThrow.test(typeof err === 'string' ? err : err.message))) {
        return new AssertionError({ message: `Expected error with message matching '${shouldThrow.source}', but got ${actual} ` });
      }
      // If passing in a constructor
    } else if (shouldThrow === Error ||
      shouldThrow === AppError ||
      Object.getPrototypeOf(shouldThrow) !== Object.getPrototypeOf(Function)
    ) { // if not simple function, treat as class
      if (!err || !(err instanceof shouldThrow)) {
        return new AssertionError({ message: `Expected to throw ${shouldThrow.name}, but got ${err ?? 'nothing'} ` });
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
        missed = new AppError(`Error thrown, but expected no errors`);
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
  static async checkThrowAsync(assertion: CaptureAssert, positive: boolean, action: Function | Promise<any>, shouldThrow?: ThrowableError, message?: string) {
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
        missed = new AppError(`Error thrown, but expected no errors`);
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
    if (Util.hasToJSON(err)) {
      delete err.toJSON; // Do not allow the value to propagate as JSON
    }

    let line = AssertUtil.getPositionOfError(err, test.file).line;
    if (line === 1) {
      line = test.lines.start;
    }

    AssertCapture.add({
      file: test.file.replace(`${FsUtil.cwd}/`, ''),
      line,
      operator: 'throws',
      error: err,
      message: err.message,
      text: ('operator' in err ? err.operator : '') || '(uncaught)'
    });
  }
}