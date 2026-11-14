import assert from 'node:assert';
import { isPromise } from 'node:util/types';

import { asConstructable, type Class, castTo, RuntimeError, type ClassInstance } from '@travetto/runtime';

import { TestExecutionError } from '../model/error.ts';
import type { Assertion, TestConfig, TestStatus, ThrowableError } from '../model/test.ts';
import { AssertCapture, type CapturedAssertion } from './capture.ts';
import { ASSERT_FN_OPERATOR, OP_MAPPING } from './types.ts';
import { AssertUtil } from './util.ts';

type StringFields<T> = {
  [K in Extract<keyof T, string>]: T[K] extends string ? K : never;
}[Extract<keyof T, string>];

const isClass = (input: unknown): input is Class =>
  input === Error || input === RuntimeError || Object.getPrototypeOf(input) !== Object.getPrototypeOf(Function);

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
    const assertFn = positive ? assert : (value: unknown, msg?: string): unknown => assert(!value, msg!);

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
      assertion.expected = { toClean: (): string => (positive ? 'truthy' : 'falsy') };
      common.state = 'should be';
    } else if (fn === 'includes') {
      assertion.operator = fn;
      [assertion.actual, assertion.expected, assertion.message] = castTo(args);
    } else if (fn === 'instanceof') {
      assertion.operator = fn;
      [assertion.actual, assertion.expected, assertion.message] = castTo(args);
      assertion.actual = asConstructable(assertion.actual)?.constructor;
    } else {
      // Handle unknown
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

      // Actually run the assertion
      switch (fn) {
        case 'includes': {
          const [actual, expected, message]: [unknown[], unknown, string] = castTo(args);
          assertFn(actual.includes(expected), message);
          break;
        }
        case 'test': {
          const [actual, expected, message]: [string, RegExp, string] = castTo(args);
          assertFn(expected.test(actual), message);
          break;
        }
        case 'instanceof': {
          const [actual, expected, message]: [ClassInstance, Class, string] = castTo(args);
          assertFn(actual instanceof expected, message);
          break;
        }
        case 'in': {
          const [actual, expected, message]: [string, object, string] = castTo(args);
          assertFn(actual in expected, message);
          break;
        }
        case 'lessThan': {
          const [actual, expected, message]: [number | BigInt, number | BigInt, string] = castTo(args);
          assertFn(actual < expected, message);
          break;
        }
        case 'lessThanEqual': {
          const [actual, expected, message]: [number | BigInt, number | BigInt, string] = castTo(args);
          assertFn(actual <= expected, message);
          break;
        }
        case 'greaterThan': {
          const [actual, expected, message]: [number | BigInt, number | BigInt, string] = castTo(args);
          assertFn(actual > expected, message);
          break;
        }
        case 'greaterThanEqual': {
          const [actual, expected, message]: [number | BigInt, number | BigInt, string] = castTo(args);
          assertFn(actual >= expected, message);
          break;
        }
        case 'ok': {
          assertFn.apply(null, castTo(args));
          break;
        }
        default:
          if (fn && fn in assert) {
            // Assert call
            if (/not/i.test(fn)) {
              common.state = 'should not';
            }
            assert[fn as 'ok'].apply(null, castTo(args));
          }
      }

      // Pushing on not error
      AssertCapture.add(assertion);
    } catch (error) {
      // On error, produce the appropriate error message
      if (error instanceof assert.AssertionError) {
        if (!assertion.message) {
          assertion.message = OP_MAPPING[fn] ?? '{state} be {expected}';
        }
        assertion.message = assertion.message
          .replace(/[{]([A-Za-z]+)[}]/g, (_, key: StringFields<Assertion>) => common[key] || assertion[key]!)
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
    if (!shouldThrow) {
      // If we shouldn't be throwing anything, we are good
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
          actual: error ?? 'nothing',
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
    errorValue: unknown,
    missed: Error | undefined,
    shouldThrow: ThrowableError | undefined,
    assertion: CapturedAssertion
  ): void {
    const error = errorValue instanceof Error ? errorValue : new Error(`${errorValue}`);

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
        throw (missed = new assert.AssertionError({
          message: `No error thrown, but expected ${shouldThrow ?? 'an error'}`,
          expected: shouldThrow ?? 'an error'
        }));
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
        throw (missed = new assert.AssertionError({
          message: `No error thrown, but expected ${shouldThrow ?? 'an error'}`,
          expected: shouldThrow ?? 'an error'
        }));
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
    const { line } = AssertUtil.getPositionOfError(error) ?? {};

    AssertCapture.add({
      import: test.declarationImport ?? test.import,
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
