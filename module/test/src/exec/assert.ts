import { AppEnv } from '@encore2/base';
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

  static start() {
    this.asserts = [];
  }

  static invoke(fn: Function) {
    try {
      fn();
    } catch (e) {
      if (e instanceof assert.AssertionError) {
        throw e;
      } else {
        let [file, line] = new Error().stack!.split('\n')[2].split(/[()]/g).slice(-2, -1)[0].split(':');
        file = file.split(process.cwd() + '/')[1];

        const assertion: Assertion = { file, line: parseInt(line, 10), operator: 'throws', text: '', error: e, message: `Error thrown: ${e.message}` };
        this.asserts.push(assertion);
        throw assertion;
      }
    }
  }

  static check(text: string, name: string, ...args: any[]) {
    let [file, line] = new Error().stack!.split('\n')[2].split(/[()]/g).slice(-2, -1)[0].split(':');
    file = file.split(process.cwd() + '/')[1];

    let assertion: Assertion = { file, line: parseInt(line, 10), text, operator: ASSERT_FN_OPERATOR[name] };
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
      assertion.operator = name;
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