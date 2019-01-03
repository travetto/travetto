import * as assert from 'assert';
import * as util from 'util';
import * as path from 'path';

import { Env, Util, Stacktrace, BaseError } from '@travetto/base';
import { Assertion, TestConfig, ThrowableError } from '../model/test';

const ASSERT_FN_OPERATOR: { [key: string]: string } = {
  equal: '==',
  notEqual: '!=',
  strictEqual: '===',
  notStrictEqual: '!==',
  greaterThanEqual: '>=',
  greaterThan: '>',
  lessThanEqual: '<=',
  lessThan: '<'
};

const OP_MAPPING: { [key: string]: string } = {
  ok: '{actual} {state} {expected}',
  includes: '{actual} {state} include {expected}',
  test: '{expected} {state} match {actual}',
  throws: '{state} throw {expected}',
  doesNotThrow: '{state} not throw {expected}',
  rejects: '{state} reject {expected}',
  doesNotReject: '{state} not reject {expected}',
  equal: '{actual} {state} equal {expected}',
  notEqual: '{actual} {state} not equal {expected}',
  deepEqual: '{actual} {state} deep equal {expected}',
  notDeepEqual: '{actual} {state} not deep equal {expected}',
  strictEqual: '{actual} {state} strictly equal {expected}',
  notStrictEqual: '{actual} {state} strictly not equal {expected}',
  deepStrictEqual: '{actual} {state} strictly deep equal {expected}',
  notStrictDeepEqual: '{actual} {state} strictly not deep equal {expected}',
  greaterThanEqual: '{actual} {state} be greater than or equal to {expected}',
  greaterThan: '{actual} {state} be greater than {expected}',
  instanceof: '{actual} instance {state} be of type {expected}',
  lessThanEqual: '{actual} {state} be less than or equal to {expected}',
  lessThan: '{actual} {state} be less than {expected}'
};

function clean(val: any) {
  if (val && val.toClean) {
    return val.toClean();
  } else if (val === null || val === undefined || (!(val instanceof RegExp) && Util.isPrimitive(val)) || Util.isPlainObject(val) || Array.isArray(val)) {
    return JSON.stringify(val);
  } else {
    if (val.__id || !val.constructor || (!val.constructor.__id && Util.isFunction(val))) {
      return val.name;
    } else {
      return util.inspect(val, false, 1).replace(/\n/g, ' ');
    }
  }
}

const excludeNode = /[\\\/]node_modules[\\\/]/;

export class AssertUtil {

  static assertions: Assertion[] = [];
  static listener?: (a: Assertion) => void;
  static test: TestConfig;

  static readFilePosition(err: Error, filename: string) {
    const base = Env.cwd;

    const lines = (err.stack || new Error().stack!).split('\n').filter(x => !excludeNode.test(x) && x.includes(base));
    let best = lines.filter(x => x.includes(filename))[0];

    if (!best) {
      best = lines.filter(x => x.includes(path.join(base, 'test')))[0];
    }

    if (!best) {
      return { file: filename, line: 1 };
    }

    const [, pth] = best.trim().split(/\s+/g).slice(1);
    const [file, lineNo] = pth.replace(/[()]/g, '').replace(/^[A-Za-z]:/, '').split(':');

    const outFileParts = file.split(base.replace(/^[A-Za-z]:/, ''));

    const outFile = outFileParts.length > 1 ? outFileParts[1].replace(/^[\\\/]/, '') : filename;

    const res = { file: outFile, line: parseInt(lineNo, 10) };

    return res;
  }

  static start(test: TestConfig, listener?: (a: Assertion) => void) {
    this.test = test;
    this.listener = listener;
    this.assertions = [];
  }

  static buildAssertion(filename: string, text: string, operator: string) {
    const { file, line } = this.readFilePosition(new Error(), filename.replace(/[.][tj]s$/, ''));

    const assertion: Assertion = {
      className: this.test.className,
      methodName: this.test.methodName,
      file, line, text,
      operator,
    };

    return assertion;
  }

  static check(filename: string, text: string, fn: string, positive: boolean, ...args: any[]) {
    const assertion = this.buildAssertion(filename, text, ASSERT_FN_OPERATOR[fn]);

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
      assertion.expected = { toClean: () => 'truthy' };
      assertion.operator = 'ok';
    } else if (fn === 'includes') {
      assertion.operator = fn;
      assertion.message = args[2];
      assertion.expected = args[0];
      assertion.actual = args[1];
    } else if (fn === 'instanceof') {
      assertion.expected = args[1];
      assertion.actual = args[0].constructor;
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
        assertion.actual = clean(assertion.actual);
      }

      if (assertion.expected !== undefined) {
        assertion.expected = clean(assertion.expected);
      }

      switch (fn) {
        case 'instanceof': asrt(args[0] instanceof args[1], args[2]); break;
        case 'lessThan': asrt(args[0] < args[1], args[2]); break;
        case 'lessThanEqual': asrt(args[0] <= args[1], args[2]); break;
        case 'greaterThan': asrt(args[0] > args[1], args[2]); break;
        case 'greaterThanEqual': asrt(args[0] >= args[1], args[2]); break;
        default:
          if (fn && (assert as any)[fn]) { // Assert call
            (assert as any)[fn].apply(null, args);
          } else if (args[1] && fn && args[1][fn]) { // Method call
            asrt(args[1][fn](args[0]));
          } else {
            asrt.apply(null, args as any); // Do normal
          }
      }

      // Pushing on not error
      this.add(assertion);
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
          (e as Error).stack = Stacktrace.simplifyStack(e as Error);
        }
        this.add(assertion);
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
        return new BaseError(`Expected error containing text '${shouldThrow}', but got ${actual}`);
      }
      if (shouldThrow instanceof RegExp && (!err || !shouldThrow.test(typeof err === 'string' ? err : err.message))) {
        return new BaseError(`Expected error with message matching '${shouldThrow.source}', but got ${actual} `);
      }
    } else if (shouldThrow === Error ||
      shouldThrow === BaseError ||
      Object.getPrototypeOf(shouldThrow) !== Object.getPrototypeOf(Function)
    ) { // if not simple function, treat as class
      if (!err || !(err instanceof shouldThrow)) {
        return new BaseError(`Expected to throw ${shouldThrow.name}, but got ${err || 'nothing'} `);
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
    const assertion = this.buildAssertion(filename, text, key);
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
        (e as Error).stack = Stacktrace.simplifyStack(e as Error);
        throw (assertion.error = e);
      }
    } finally {
      this.add(assertion);
    }
  }

  static async checkThrowAsync(filename: string, text: string, key: string, negative: boolean,
    action: Function, shouldThrow?: ThrowableError, message?: string) {
    const assertion = this.buildAssertion(filename, text, key);
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
        (e as Error).stack = Stacktrace.simplifyStack(e as Error);
        throw (assertion.error = e);
      }
    } finally {
      this.add(assertion);
    }
  }

  static add(a: Assertion) {
    this.assertions.push(a);
    if (this.listener) {
      this.listener(a);
    }
  }

  static end() {
    const ret = this.assertions;
    this.assertions = [];
    delete this.listener, this.test;
    return ret;
  }
}