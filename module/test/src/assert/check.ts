import assert from 'node:assert';
import { isPromise } from 'node:util/types';

import { RuntimeError, type Class, castTo, castKey, asConstructable } from '@travetto/runtime';

import type { ThrowableError, TestConfig, Assertion, TestStatus } from '../model/test.ts';
import { AssertCapture, type CapturedAssertion } from './capture.ts';
import { AssertUtil } from './util.ts';
import { ASSERT_FN_OPERATOR, OP_MAPPING } from './types.ts';
import { TestExecutionError } from '../model/error.ts';

type StringFields<T> = {
  [K in Extract<keyof T, string>]:
  (T[K] extends string ? K : never)
}[Extract<keyof T, string>];

const isClass = (input: unknown): input is Class => input === Error || input === RuntimeError || Object.getPrototypeOf(input) !== Object.getPrototypeOf(Function);

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
  static check(assertion: CapturedAssertion, positive: boolean, ...args: unknown[]): void {
    let fn = assertion.operator;
    assertion.operator = ASSERT_FN_OPERATOR[fn];

    // Determine text based on positivity
    const common: Record<string, string> = {
      state: positive ? 'should' : 'should not'
    };

    // Invert check for negative
    const assertFn = positive ? assert : (value: unknown, msg?: string): unknown => assert(!value, msg);

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
    } catch (error) {
      // On error, produce the appropriate error message
      if (error instanceof assert.AssertionError) {
        if (!assertion.message) {
          assertion.message = (OP_MAPPING[fn] ?? '{state} be {expected}');
        }
        assertion.message = assertion.message
          .replace(/[{]([A-Za-z]+)[}]/g, (a, key: StringFields<Assertion>) => common[key] || assertion[key]!)
          .replace(/not not/g, ''); // Handle double negatives
        assertion.error = error;
        error.message = assertion.message;
        AssertCapture.add(assertion);
      }
      throw error;
    }
  }

  /**
   * Check a given error
   * @param shouldThrow  Should the test throw anything
   * @param error The provided error
   */
  static checkError(shouldThrow: ThrowableError | undefined, error: Error | string | undefined): Error | undefined {
    if (!shouldThrow) { // If we shouldn't be throwing anything, we are good
      return;
    } else if (!error) {
      return new assert.AssertionError({ message: 'Expected to throw an error, but got nothing' });
    } else if (typeof shouldThrow === 'string') {
      if (!(error instanceof Error ? error.message : error).includes(shouldThrow)) {
        const actual = error instanceof Error ? `'${error.message}'` : `'${error}'`;
        return new assert.AssertionError({
          message: `Expected error containing text '${shouldThrow}', but got ${actual}`,
          actual,
          expected: shouldThrow
        });
      }
    } else if (shouldThrow instanceof RegExp) {
      if (!shouldThrow.test(typeof error === 'string' ? error : error.message)) {
        const actual = error instanceof Error ? `'${error.message}'` : `'${error}'`;
        return new assert.AssertionError({
          message: `Expected error with message matching '${shouldThrow.source}', but got ${actual}`,
          actual,
          expected: shouldThrow.source
        });
      }
    } else if (isClass(shouldThrow)) {
      if (!(error instanceof shouldThrow)) {
        return new assert.AssertionError({
          message: `Expected to throw ${shouldThrow.name}, but got ${error}`,
          actual: (error ?? 'nothing'),
          expected: shouldThrow.name
        });
      }
    } else if (typeof shouldThrow === 'function') {
      const target = shouldThrow.name ? `("${shouldThrow.name}")` : '';
      try {
        const result = shouldThrow(error);
        if (result === false) {
          return new assert.AssertionError({ message: `Checking function ${target} indicated an invalid error`, actual: error });
        } else if (typeof result === 'string') {
          return new assert.AssertionError({ message: result, actual: error });
        }
      } catch (checkError) {
        if (checkError instanceof assert.AssertionError) {
          return checkError;
        } else {
          return new assert.AssertionError({ message: `Checking function ${target} threw an error`, actual: checkError });
        }
      }
    }
  }

  static #onError(
    positive: boolean,
    message: string | undefined,
    error: unknown,
    missed: Error | undefined,
    shouldThrow: ThrowableError | undefined,
    assertion: CapturedAssertion
  ): void {
    if (!(error instanceof Error)) {
      error = new Error(`${error}`);
    }
    if (!(error instanceof Error)) {
      throw error;
    }
    if (positive) {
      missed = new assert.AssertionError({ message: 'Error thrown, but expected no errors' });
      missed.stack = error.stack;
    }

    const resolvedError = (missed && error) ?? this.checkError(shouldThrow, error);
    if (resolvedError) {
      assertion.message = message || missed?.message || resolvedError.message;
      throw (assertion.error = resolvedError);
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
    assertion: CapturedAssertion,
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
        throw (missed = new assert.AssertionError({ message: `No error thrown, but expected ${shouldThrow ?? 'an error'}`, expected: shouldThrow ?? 'an error' }));
      }
    } catch (error) {
      this.#onError(positive, message, error, missed, shouldThrow, assertion);
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
    assertion: CapturedAssertion,
    positive: boolean,
    action: Function | Promise<unknown>,
    shouldThrow?: ThrowableError,
    message?: string
  ): Promise<void> {
    let missed: Error | undefined;

    try {
      if (isPromise(action)) {
        await action;
      } else {
        await action();
      }
      if (!positive) {
        if (typeof shouldThrow === 'function') {
          shouldThrow = shouldThrow.name;
        }
        throw (missed = new assert.AssertionError({ message: `No error thrown, but expected ${shouldThrow ?? 'an error'}`, expected: shouldThrow ?? 'an error' }));
      }
    } catch (error) {
      this.#onError(positive, message, error, missed, shouldThrow, assertion);
    } finally {
      AssertCapture.add(assertion);
    }
  }

  /**
   * Look for any unhandled exceptions
   */
  static checkUnhandled(test: TestConfig, error: Error | assert.AssertionError): void {
    const { line } = AssertUtil.getPositionOfError(error, test.sourceImport ?? test.import);

    AssertCapture.add({
      import: test.import,
      line: line ?? test.lineStart,
      operator: 'throws',
      error,
      unexpected: true,
      message: error.message,
      text: ('operator' in error ? error.operator : '') || '(uncaught)'
    });
  }

  /**
   * Validate the test result based on the error and test configuration
   */
  static validateTestResultError(test: TestConfig, error: Error | undefined): [TestStatus, Error | undefined] {
    if (error instanceof assert.AssertionError) {
      return ['failed', error];
    } else if (error instanceof TestExecutionError) {
      this.checkUnhandled(test, error);
      return ['errored', error];
    } else if (error === undefined || test.shouldThrow) {
      error = this.checkError(test.shouldThrow, error); // Rewrite error
      return [error ? 'failed' : 'passed', error];
    } else {
      this.checkUnhandled(test, error);
      return ['errored', error];
    }
  }
}