import * as assert from 'assert';

import { Stacktrace, AppError } from '@travetto/base';

import { ThrowableError, TestConfig } from '../model/test';
import { AssertCapture } from './capture';
import { AssertUtil } from './util';
import { ASSERT_FN_OPERATOR, OP_MAPPING } from './types';

export class AssertCheck {
  static check(filename: string, text: string, fn: string, positive: boolean, ...args: any[]) {
    const assertion = AssertCapture.buildAssertion(filename, text, ASSERT_FN_OPERATOR[fn]);

    const common: { [key: string]: string } = {
      state: positive ? 'should' : 'should not'
    };

    const asrt = positive ? assert : (x: any, msg?: string) => assert(!x, msg);

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
      common.state = 'should';
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
    } else {
      assertion.operator = fn || '';
      assertion.message = args[2];
      assertion.expected = args[1];
      assertion.actual = args[0];
    }

    try {
      if (assertion.actual !== undefined) {
        assertion.actual = AssertUtil.cleanValue(assertion.actual);
      }

      if (assertion.expected !== undefined) {
        assertion.expected = AssertUtil.cleanValue(assertion.expected);
      }

      switch (fn) {
        case 'instanceof': asrt(args[0] instanceof args[1], args[2]); break;
        case 'lessThan': asrt(args[0] < args[1], args[2]); break;
        case 'lessThanEqual': asrt(args[0] <= args[1], args[2]); break;
        case 'greaterThan': asrt(args[0] > args[1], args[2]); break;
        case 'greaterThanEqual': asrt(args[0] >= args[1], args[2]); break;
        case 'ok': asrt.apply(null, args as any); break;
        default:
          if (fn && (assert as any)[fn]) { // Assert call
            (assert as any)[fn].apply(null, args);
          } else if (args[1] && fn && args[1][fn]) { // Method call
            asrt(args[1][fn](args[0]));
          }
      }

      // Pushing on not error
      AssertCapture.add(assertion);
    } catch (e) {
      if (e instanceof assert.AssertionError) {
        if (!assertion.message) {
          assertion.message = (OP_MAPPING[fn] || `{state} be {expected}`);
        }
        assertion.message = assertion.message
          .replace(/[{]([A-Za-z]+)[}]/g, (a, k) => common[k] || (assertion as any)[k])
          .replace(/not not/g, ''); // Handle double negatives
        assertion.error = e;
        e.message = assertion.message;
        if (e instanceof Error) {
          (e as Error).stack = Stacktrace.simplifyStack(e);
        }
        AssertCapture.add(assertion);
      }
      throw e;
    }
  }

  static checkError(shouldThrow: ThrowableError | undefined, err: Error | string | undefined): Error | undefined {
    if (!shouldThrow) {
      return; // If nothing defined, then all errors are expected
    }
    if (typeof shouldThrow === 'string' || shouldThrow instanceof RegExp) {
      const actual = `${err instanceof Error ? `'${err.message}'` : (err ? `'${err}'` : 'nothing')}`;

      if (typeof shouldThrow === 'string' && (!err || !(err instanceof Error ? err.message : err).includes(shouldThrow))) {
        return new AppError(`Expected error containing text '${shouldThrow}', but got ${actual}`, 'data');
      }
      if (shouldThrow instanceof RegExp && (!err || !shouldThrow.test(typeof err === 'string' ? err : err.message))) {
        return new AppError(`Expected error with message matching '${shouldThrow.source}', but got ${actual} `, 'data');
      }
    } else if (shouldThrow === Error ||
      shouldThrow === AppError ||
      Object.getPrototypeOf(shouldThrow) !== Object.getPrototypeOf(Function)
    ) { // if not simple function, treat as class
      if (!err || !(err instanceof shouldThrow)) {
        return new AppError(`Expected to throw ${shouldThrow.name}, but got ${err || 'nothing'} `, 'notfound');
      }
    } else {
      const res = shouldThrow(err);
      if (res && !(res instanceof Error)) {
        return new Error(`Invalid check, "${shouldThrow.name}" should return an Error or undefined`);
      } else {
        return res;
      }
    }
  }

  static checkThrow(filename: string, text: string, key: string, negative: boolean,
    action: Function, shouldThrow?: ThrowableError, message?: string) {
    const assertion = AssertCapture.buildAssertion(filename, text, key);
    let missed: Error | undefined;

    try {
      action();
      if (negative) {
        throw (missed = new Error(`No error thrown, but expected ${shouldThrow || 'an error'} `));
      }
    } catch (e) {
      if (!negative) {
        missed = new Error(`Error thrown, but expected no errors `);
      }

      e = missed || this.checkError(shouldThrow, e);
      if (e) {
        assertion.message = message || e.message;
        (e as Error).stack = Stacktrace.simplifyStack(e);
        throw (assertion.error = e);
      }
    } finally {
      AssertCapture.add(assertion);
    }
  }

  static async checkThrowAsync(filename: string, text: string, key: string, negative: boolean,
    action: Function, shouldThrow?: ThrowableError, message?: string) {
    const assertion = AssertCapture.buildAssertion(filename, text, key);
    let missed: Error | undefined;

    try {
      await action();
      if (negative) {
        throw (missed = new Error(`No error thrown, but expected ${shouldThrow || 'an error'} `));
      }
    } catch (e) {
      if (!negative) {
        missed = new Error(`Error thrown, but expected no errors `);
      }

      e = missed || this.checkError(shouldThrow, e);
      if (e) {
        assertion.message = message || e.message;
        (e as Error).stack = Stacktrace.simplifyStack(e);
        throw (assertion.error = e);
      }
    } finally {
      AssertCapture.add(assertion);
    }
  }

  static checkUnhandled(test: TestConfig, err: Error) {
    delete (err as any).toJSON; // Do not allow the value to propagate as JSON

    let line = AssertUtil.getPositionOfError(err, test.file).line;
    if (line === 1) {
      line = test.lines.start;
    }

    AssertCapture.add({
      className: test.className,
      methodName: test.methodName,
      file: test.file,
      line,
      operator: 'throws',
      error: err,
      message: err.message,
      text: (err as any).operator || '(uncaught)'
    });
  }
}