import * as util from 'util';

import { Env, Util } from '@travetto/base';
import { TestConfig, Assertion, TestResult } from '../model/test';
import { SuiteConfig } from '../model/suite';

export class AssertUtil {
  static cleanValue(val: any) {
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

  static getPositionOfError(err: Error, filename: string) {
    const base = Env.cwd;

    const lines = (err.stack || new Error().stack!)
      .replace(/[\\]/g, '/')
      .split('\n')
      .filter(x => !/[\/]node_modules[\/]/.test(x) && x.includes(base));

    let best = lines.filter(x => x.includes(filename))[0];

    if (!best) {
      best = lines.filter(x => x.includes(`${base}/test`))[0];
    }

    if (!best) {
      return { file: filename, line: 1 };
    }

    const [, pth] = best.trim().split(/\s+/g).slice(1);
    const [file, lineNo] = pth.replace(/[()]/g, '').replace(/^[A-Za-z]:/, '').split(':');
    let line = parseInt(lineNo, 10);
    if (Number.isNaN(line)) {
      line = -1;
    }

    const outFileParts = file.split(base.replace(/^[A-Za-z]:/, ''));

    const outFile = outFileParts.length > 1 ? outFileParts[1].replace(/^[\/]/, '') : filename;

    const res = { file: outFile, line };

    return res;
  }

  static generateSuiteError(suite: SuiteConfig, methodName: string, error: Error) {
    // tslint:disable:prefer-const
    let { line, file } = this.getPositionOfError(error, suite.file);

    if (line === 1) {
      line = suite.lines.start;
    }

    const msg = error.message.split(/\n/)[0];

    const core = { file, className: suite.className, methodName };
    const coreAll = { ...core, description: msg, lines: { start: line, end: line } };

    const assert: Assertion = {
      ...core,
      operator: 'throw', error, line, message: msg, text: methodName
    };
    const testResult: TestResult = {
      ...coreAll,
      status: 'fail', error, duration: 0, durationTotal: 0, assertions: [assert], output: {}
    };
    const testConfig: TestConfig = {
      ...coreAll,
      class: suite.class, skip: false
    };

    return { assert, testResult, testConfig };
  }
}