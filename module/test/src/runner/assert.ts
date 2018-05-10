import { AppEnv, isPlainObject, isFunction, isPrimitive } from '@travetto/base';
import * as assert from 'assert';
import * as util from 'util';
import { Assertion, TestConfig } from '../model';

const ASSERT_FN_OPERATOR: { [key: string]: string } = {
  equal: '==',
  notEqual: '!=',
  strictEqual: '===',
  notStrictEqual: '!==',
  greaterThanEqual: '>=',
  greaterThan: '>',
  lessThanEqual: '<=',
  lessThan: '<'
}

const OP_MAPPING: { [key: string]: string } = {
  includes: '{expected} {state} include {actual}',
  test: '{expected} {state} match {actual}',
  throws: '{state} throw {expected}',
  doesNotThrow: '{state} not throw {expected}',
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
  lessThanEqual: '{actual} {state} be less than or equal to {expected}',
  lessThan: '{actual} {state} be less than {expected}'
}

function clean(val: any) {
  if (val === null || val === undefined || (!(val instanceof RegExp) && isPrimitive(val)) || isPlainObject(val) || Array.isArray(val)) {
    return JSON.stringify(val);
  } else {
    if (!val.constructor || (!val.constructor.__id && isFunction(val))) {
      return val.name;
    } else {
      return util.inspect(val, false, 1).replace(/\n/g, ' ');
    }
  }
}

export class AssertUtil {

  static assertions: Assertion[] = [];
  static listener?: (a: Assertion) => void;
  static test: TestConfig;

  static readFilePosition(err: Error, filename: string) {
    const base = process.cwd();
    const lines = (err.stack || new Error().stack!).split('\n').filter(x => !x.includes('/node_modules/') && x.includes(base));
    let best = lines.filter(x => x.includes(filename))[0];

    if (!best) {
      best = lines.filter(x => x.includes(`${base}/test`))[0];
    }

    if (!best) {
      return { file: filename, line: 1 };
    }

    const [fn, path] = best.trim().split(/\s+/g).slice(1);
    const [file, lineNo, col] = path.replace(/[()]/g, '').split(':')

    const outFile = file.split(`${process.cwd()}/`)[1];

    const res = { file: outFile, line: parseInt(lineNo, 10) };

    return res;
  }

  static start(test: TestConfig, listener?: (a: Assertion) => void) {
    this.test = test;
    this.listener = listener;
    this.assertions = [];
  }

  static check(filename: string, text: string, fn: string, positive: boolean, ...args: any[]) {
    const { file, line } = this.readFilePosition(new Error(), filename.replace(/[.][tj]s$/, ''));

    const assertion: Assertion = {
      className: this.test.className,
      methodName: this.test.methodName,
      file, line, text,
      operator: ASSERT_FN_OPERATOR[fn],
    };

    const common: { [key: string]: string } = {
      state: positive ? 'should' : 'should not'
    };

    const asrt = positive ? assert : (x: any, msg?: string) => assert(!x, msg);

    if (fn === 'fail') {
      if (args.length > 1) {
        assertion.actual = args[0];
        assertion.expected = args[1];
        assertion.message = args[2];
        assertion.operator = args[3]
      } else {
        assertion.message = args[0];
      }
    } else if (/throw/i.test(fn)) {
      assertion.operator = 'throw';
      if (typeof args[1] !== 'string') {
        assertion.expected = args[1];
        assertion.message = args[2];
      } else {
        assertion.message = args[1];
      }
    } else if (fn === 'ok' || fn === 'assert') {
      assertion.actual = args[0];
      assertion.message = args[1];
      assertion.expected = true;
      assertion.operator = '';
    } else {
      assertion.operator = fn || '';
      assertion.message = args[2];
      assertion.expected = args[1];
      assertion.actual = args[0];
    }

    try {
      if (assertion.actual) {
        assertion.actual = clean(assertion.actual);
      }

      if (assertion.expected) {
        assertion.expected = clean(assertion.expected);
      }

      switch (fn) {
        case 'instanceOf': asrt(args[0] instanceof args[1], args[2]); break;
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
            asrt.apply(null, args); // Do normal
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
          .replace(/not not/g, 'not'); // Handle double negatives
        assertion.error = e;
        this.add(assertion);
      }
      throw e;
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