import { AppEnv } from '@travetto/base';
import * as assert from 'assert';
import { Assertion } from '../model';
import * as _ from 'lodash';

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
  includes: '$1 should include $0',
  test: '$1 should match $0',
  throws: '$0 should throw $1',
  equal: '$0 should equal $1',
  notEqual: '$0 should not equal $1',
  strictEqual: '$0 should strictly equal $1',
  notStrictEqual: '$0 should strictly not equal $1',
  greaterThanEqual: '$0 should be greater than or equal to $1',
  greaterThan: '$0 should be greater than $1',
  lessThanEqual: '$0 should be less than or equal to $1',
  lessThan: '$0 should be less than $1'
}

function clean(val: any) {
  if (val === null || val === undefined || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || _.isPlainObject(val)) {
    return val;
  } else {
    return `${val}`;
  }
}

export class AssertUtil {

  static asserts: Assertion[] = [];

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

  static start() {
    this.asserts = [];
  }

  static check(filename: string, text: string, name: string, ...args: any[]) {
    const { file, line } = this.readFilePosition(new Error(), filename.replace(/[.][tj]s$/, ''));

    const assertion: Assertion = { file, line, text, operator: ASSERT_FN_OPERATOR[name] };
    if (name === 'fail') {
      if (args.length > 1) {
        assertion.actual = args[0];
        assertion.expected = args[1];
        assertion.message = args[2];
        assertion.operator = args[3]
      } else {
        assertion.message = args[0];
      }
    } else if (/throw/i.test(name)) {
      assertion.operator = 'throw';
      if (typeof args[1] !== 'string') {
        assertion.expected = args[1];
        assertion.message = args[2];
      } else {
        assertion.message = args[1];
      }
    } else if (name === 'ok' || name === 'assert') {
      assertion.actual = args[0];
      assertion.message = args[1];
      assertion.expected = true;
      assertion.operator = '';
    } else {
      assertion.operator = name || '';
      assertion.message = args[2];
      assertion.expected = args[1];
      assertion.actual = args[0];
    }

    try {
      switch (name) {
        case 'instanceOf': assert(args[0] instanceof args[1], args[2]); break;
        case 'lessThan': assert(args[0] < args[1], args[2]); break;
        case 'lessThanEqual': assert(args[0] <= args[1], args[2]); break;
        case 'greaterThan': assert(args[0] > args[1], args[2]); break;
        case 'greaterThanEqual': assert(args[0] >= args[1], args[2]); break;
        case 'assert': assert.apply(assert, args); break;
        default:
          if (args[1][name]) {
            assert(args[1][name](args[0]));
          } else {
            (assert as any)[name].apply(null, args);
          }
      }

      if (assertion.actual) {
        assertion.actual = clean(assertion.actual);
      }

      if (assertion.expected) {
        assertion.expected = clean(assertion.expected);
      }

      // Pushing on not error
      this.asserts.push(assertion);
    } catch (e) {
      if (e instanceof assert.AssertionError) {
        if (!assertion.message) {
          if (assertion.operator) {
            assertion.message = OP_MAPPING[name].replace(/\$([0-9]+)/g, (a, n) => args[n]);
          } else {
            assertion.message = `should be ${clean(assertion.expected)}`;
          }
        }
        assertion.error = e;
        this.asserts.push(assertion);
      }
      throw e;
    }
  }

  static end() {
    const ret = this.asserts;
    this.asserts = [];
    return ret;
  }
}