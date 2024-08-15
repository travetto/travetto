import assert from 'node:assert';

import { AppError, Class, castTo, castKey, asConstructable } from '@travetto/runtime';

import { ThrowableError, TestConfig, Assertion } from '../model/test';
import { AssertCapture, CaptureAssert } from './capture';
import { AssertUtil } from './util';
import { ASSERT_FN_OPERATOR, OP_MAPPING } from './types';

type StringFields<T> = {
  [K in Extract<keyof T, string>]:
  (T[K] extends string ? K : never)
}[Extract<keyof T, string>];

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
  static check(assertion: CaptureAssert, positive: boolean, ...args: unknown[]): void {
    let fn = assertion.operator;
    assertion.operator = ASSERT_FN_OPERATOR[fn];

    // Determine text based on positivity
    const common: Record<string, string> = {
      state: positive ? 'should' : 'should not'
    };

    // Invert check for negative
    const assertFn = positive ? assert : (x: unknown, msg?: string): unknown => assert(!x, msg);

    // Check fn to call
    if (fn === 'fail') {
      if (args.length > 1) {
        [assertion.actual, assertion.expected, assertion.message, assertion.operator] = castTo(args);
      } else {
        [assertion.message] = castTo(args);
      }
    } else if (/throw|reject/i.test(fn)) {
      assertion.operator = fn;
      if (typeof args[1] !== 'string') {
        [, assertion.expected, assertion.message] = castTo(args);
      } else {
        [, assertion.message] = castTo(args);
      }
    } else if (fn === 'ok' || fn === 'assert') {
      fn = assertion.operator = 'ok';
      [assertion.actual, assertion.message] = castTo(args);
      assertion.expected = { toClean: (): string => positive ? 'truthy' : 'falsy' };
      common.state = 'should be';
    } else if (fn === 'includes') {
      assertion.operator = fn;
      [assertion.actual, assertion.expected, assertion.message] = castTo(args);
    } else if (fn === 'instanceof') {
      assertion.operator = fn;
      [assertion.actual, assertion.expected, assertion.message] = castTo(args);
      assertion.actual = asConstructable(assertion.actual)?.constructor;
    } else { // Handle unknown
      assertion.operator = fn ?? '';
      [assertion.actual, assertion.expected, assertion.message] = castTo(args);
    }

    try {
      // Clean actual/expected
      if (assertion.actual !== undefined) {
        assertion.actual = AssertUtil.cleanValue(assertion.actual);
      }

      if (assertion.expected !== undefined) {
        assertion.expected = AssertUtil.cleanValue(assertion.expected);
      }

      const [actual, expected, message]: [unknown, unknown, string] = castTo(args);

      // Actually run the assertion
      switch (fn) {
        case 'includes': assertFn(castTo<unknown[]>(actual).includes(expected), message); break;
        case 'test': assertFn(castTo<RegExp>(expected).test(castTo(actual)), message); break;
        case 'instanceof': assertFn(actual instanceof castTo<Class>(expected), message); break;
        case 'in': assertFn(castTo<string>(actual) in castTo<object>(expected), message); break;
        case 'lessThan': assertFn(castTo<number>(actual) < castTo<number>(expected), message); break;
        case 'lessThanEqual': assertFn(castTo<number>(actual) <= castTo<number>(expected), message); break;
        case 'greaterThan': assertFn(castTo<number>(actual) > castTo<number>(expected), message); break;
        case 'greaterThanEqual': assertFn(castTo<number>(actual) >= castTo<number>(expected), message); break;
        case 'ok': assertFn(...castTo<Parameters<typeof assertFn>>(args)); break;
        default:
          if (fn && assert[castKey<typeof assert>(fn)]) { // Assert call
            if (/not/i.test(fn)) {
              common.state = 'should not';
            }
            assert[castTo<'ok'>(fn)].apply(null, castTo(args));
          }
      }

      // Pushing on not error
      AssertCapture.add(assertion);
    } catch (err) {
      // On error, produce the appropriate error message
      if (err instanceof assert.AssertionError) {
        if (!assertion.message) {
          assertion.message = (OP_MAPPING[fn] ?? '{state} be {expected}');
        }
        assertion.message = assertion.message
          .replace(/[{]([A-Za-z]+)[}]/g, (a, k: StringFields<Assertion>) => common[k] || assertion[k]!)
          .replace(/not not/g, ''); // Handle double negatives
        assertion.error = err;
        err.message = assertion.message;
        AssertCapture.add(assertion);
      }
      throw err;
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
        return new assert.AssertionError({
          message: `Expected error containing text '${shouldThrow}', but got ${actual}`,
          actual,
          expected: shouldThrow
        });
      }
      // If a regexp, check if error exists, and then test the error message against the regex
      if (shouldThrow instanceof RegExp && (!err || !shouldThrow.test(typeof err === 'string' ? err : err.message))) {
        return new assert.AssertionError({
          message: `Expected error with message matching '${shouldThrow.source}', but got ${actual}`,
          actual,
          expected: shouldThrow.source
        });
      }
      // If passing in a constructor
    } else if (shouldThrow === Error ||
      shouldThrow === AppError ||
      Object.getPrototypeOf(shouldThrow) !== Object.getPrototypeOf(Function)
    ) { // if not simple function, treat as class
      if (!err || !(err instanceof shouldThrow)) {
        return new assert.AssertionError({
          message: `Expected to throw ${shouldThrow.name}, but got ${err ?? 'nothing'}`,
          actual: (err ?? 'nothing'),
          expected: shouldThrow.name
        });
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

  static #onError(
    positive: boolean,
    message: string | undefined,
    err: unknown, missed: Error | undefined,
    shouldThrow: ThrowableError | undefined,
    assertion: CaptureAssert
  ): void {
    if (!(err instanceof Error)) {
      err = new Error(`${err}`);
    }
    if (!(err instanceof Error)) {
      throw err;
    }
    if (positive) {
      missed = new AppError('Error thrown, but expected no errors');
      missed.stack = err.stack;
    }

    const resolvedErr = (missed && err) ?? this.checkError(shouldThrow, err);
    if (resolvedErr) {
      assertion.message = message || missed?.message || resolvedErr.message;
      throw (assertion.error = resolvedErr);
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
  static checkThrow(
    assertion: CaptureAssert,
    positive: boolean,
    action: Function,
    shouldThrow?: ThrowableError,
    message?: string
  ): void {
    let missed: Error | undefined;

    try {
      action();
      if (!positive) {
        if (typeof shouldThrow === 'function') {
          shouldThrow = shouldThrow.name;
        }
        throw (missed = new AppError(`No error thrown, but expected ${shouldThrow ?? 'an error'}`));
      }
    } catch (err) {
      this.#onError(positive, message, err, missed, shouldThrow, assertion);
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
  static async checkThrowAsync(
    assertion: CaptureAssert,
    positive: boolean,
    action: Function | Promise<unknown>,
    shouldThrow?: ThrowableError,
    message?: string
  ): Promise<void> {
    let missed: Error | undefined;

    try {
      if ('then' in action) {
        await action;
      } else {
        await action();
      }
      if (!positive) {
        if (typeof shouldThrow === 'function') {
          shouldThrow = shouldThrow.name;
        }
        throw (missed = new AppError(`No error thrown, but expected ${shouldThrow ?? 'an error'} `));
      }
    } catch (err) {
      this.#onError(positive, message, err, missed, shouldThrow, assertion);
    } finally {
      AssertCapture.add(assertion);
    }
  }

  /**
   * Look for any unhandled exceptions
   */
  static checkUnhandled(test: TestConfig, err: Error | assert.AssertionError): void {
    let line = AssertUtil.getPositionOfError(err, test.sourceImport ?? test.import).line;
    if (line === 1) {
      line = test.lineStart;
    }

    AssertCapture.add({
      import: test.import,
      line,
      operator: 'throws',
      error: err,
      message: err.message,
      text: ('operator' in err ? err.operator : '') || '(uncaught)'
    });
  }
}