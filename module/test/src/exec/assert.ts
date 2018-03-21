import { AppEnv } from '@travetto/base';
import * as assert from 'assert';
import { Assertion } from '../model';

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

export class AssertUtil {

  static asserts: Assertion[] = [];

  static readFilePosition(err: Error, filename: string) {
    let base = process.cwd();
    let lines = err.stack!.split('\n').filter(x => !x.includes('/node_modules/') && x.includes(base));
    let best = lines.filter(x => x.includes(filename))[0];

    if (!best) {
      best = lines.filter(x => x.includes(`${base}/test`))[0];
    }

    if (!best) {
      return { file: 'unknown', line: 0 };
    }

    let [fn, path] = best.trim().split(/\s+/g).slice(1);
    let [file, lineNo, col] = path.replace(/[()]/g, '').split(':')

    file = file.split(process.cwd() + '/')[1];

    let res = { file, line: parseInt(lineNo, 10) };

    return res;
  }

  static start() {
    this.asserts = [];
  }

  static check(filename: string, text: string, name: string, ...args: any[]) {
    let { file, line } = this.readFilePosition(new Error(), filename.replace(/[.][tj]s$/, ''));

    let assertion: Assertion = { file, line, text, operator: ASSERT_FN_OPERATOR[name] };
    if (name === 'fail') {
      if (args.length > 1) {
        assertion.actual = args[0];
        assertion.expected = args[1];
        assertion.message = args[2];
        assertion.operator = args[3]
      } else {
        assertion.message = args[0];
      }
    } else if (name.includes('hrow')) {
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
          (assert as any)[name].apply(null, args);
      }
      // Pushing on not error
      this.asserts.push(assertion);
    } catch (e) {
      if (e instanceof assert.AssertionError) {
        if (!assertion.message) {
          if (assertion.operator) {
            let op = name.includes('hrow') ?
              `should ${assertion.operator}` :
              `should be ${assertion.operator}`;
            assertion.message = `${assertion.actual} ${op} ${assertion.expected}`;
          } else {
            assertion.message = `should be ${assertion.expected}`;
          }
        }
        assertion.error = e;
        this.asserts.push(assertion);
      }
      throw e;
    }
  }

  static end() {
    let ret = this.asserts;
    this.asserts = [];
    return ret;
  }
}