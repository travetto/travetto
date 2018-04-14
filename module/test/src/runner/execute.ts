import * as fs from 'fs';
import * as readline from 'readline';
import * as assert from 'assert';
import { bulkFind } from '@travetto/base';

import { TestConfig, TestResult, SuiteConfig, SuiteResult, Assertion } from '../model';
import { TestRegistry } from '../service';
import { ConsoleCapture } from './console';
import { AssertUtil } from './assert';
import { Consumer } from '../consumer';
import { SuitePhase } from '..';

export const BREAKOUT = Symbol('breakout');

export class ExecuteUtil {

  static timeout = 5000;

  static async affixProcess(suite: SuiteConfig, result: SuiteResult, phase: SuitePhase) {
    try {
      for (const fn of suite[phase]) {
        await fn.call(suite.instance);
      }
    } catch (error) {
      const { line, file } = AssertUtil.readFilePosition(error, suite.file);
      result.tests.push({
        status: 'fail',
        className: suite.className,
        methodName: phase,
        description: phase,
        lines: { start: line, end: line },
        file,
        error,
        assertions: [],
        output: {}
      } as TestResult);
      throw BREAKOUT;
    }
  }

  static async stubSuiteFailure(suite: SuiteConfig, e: Error, consumer?: Consumer) {
    if (!consumer) {
      return;
    }

    const test = {
      className: suite.className,
      lines: { ...suite.lines },
      status: 'fail',
      methodName: 'all',
      error: e,
      output: { error: e.stack },
      assertions: [{
        file: suite.file,
        line: suite.lines.start,
        text: '(init)',
        error: e,
        message: e.message,
        operator: 'throws'
      }],
      class: suite.class.name,
      description: '',
      file: suite.file
    } as TestResult;

    consumer.onEvent({ phase: 'after', type: 'test', test });
    consumer.onEvent({
      phase: 'after', type: 'suite', suite: {
        success: 0,
        fail: 1,
        skip: 0,
        total: 1
      } as SuiteResult
    });
  }

  static isTest(file: string) {
    return new Promise<boolean>((resolve, reject) => {
      const input = fs.createReadStream(file);
      const reader = readline.createInterface({ input })
        .on('line', line => {
          if (line.includes('@Suite')) {
            resolve(true);
            reader.close();
          }
        })
        .on('end', resolve.bind(null, false))
        .on('close', resolve.bind(null, false));
    });
  }

  static async getTests(globs: string[]) {
    const files = await bulkFind(globs);
    const all = await Promise.all(files.map(async (f) => [f, await this.isTest(f)] as [string, boolean]));
    return all.filter(x => x[1]).map(x => x[0]);
  }

  static checkError(test: TestConfig, err: Error | string) {
    if (test.shouldError) {
      if (typeof test.shouldError === 'string') {
        if (err.constructor.name === test.shouldError) {
          return;
        } else {
          return new Error(`Expected error to be of type ${test.shouldError}`);
        }
      } else if (test.shouldError instanceof RegExp) {
        if (test.shouldError.test(typeof err === 'string' ? err : err.message)) {
          return;
        } else {
          return new Error(`Expected error to match ${test.shouldError.source}`);
        }
      } else {
        if (test.shouldError(err)) {
          return;
        }
      }
    }
    return err;
  }

  static async executeTest(consumer: Consumer, test: TestConfig) {

    consumer.onEvent({ type: 'test', phase: 'before', test });

    const suite = TestRegistry.get(test.class);
    const result: Partial<TestResult> = {
      methodName: test.methodName,
      description: test.description,
      className: test.className,
      lines: { ...test.lines },
      file: test.file,
      status: 'skip'
    };

    if (test.skip) {
      return result as TestResult;
    }

    try {
      ConsoleCapture.start();

      AssertUtil.start((a) => consumer.onEvent({ type: 'assertion', phase: 'after', assertion: a }));

      const timeout = new Promise((_, reject) => setTimeout(reject, this.timeout).unref());
      const res = await Promise.race([suite.instance[test.methodName](), timeout]);
      result.status = 'success';
    } catch (err) {
      err = this.checkError(test, err);
      if (!err) {
        result.status = 'success';
      } else {
        result.status = 'fail';
        result.error = err;
      }
    } finally {
      result.output = ConsoleCapture.end();
      result.assertions = AssertUtil.end();
    }

    if (result.status === 'fail' && result.error) {
      const err = result.error;
      if (!(err instanceof assert.AssertionError)) {
        const { file, line } = AssertUtil.readFilePosition(err, test.file);
        const assertion: Assertion = { file, line, operator: 'throws', text: '(uncaught)', error: err, message: err.message };
        // result.output = result.output || {};
        // result.output['error'] = `${(result.output['error'] || '')}\n${err.stack}`;
        result.assertions.push(assertion);
      }
    }

    consumer.onEvent({ type: 'test', phase: 'after', test: result as TestResult });

    return result as TestResult;
  }

  static async executeSuiteTest(consumer: Consumer, suite: SuiteConfig, test: TestConfig) {
    try {
      const result: SuiteResult = {
        success: 0,
        fail: 0,
        skip: 0,
        total: 0,
        lines: { ...suite.lines },
        file: suite.file,
        className: suite.className,
        tests: []
      };

      try {
        await this.affixProcess(suite, result, 'beforeAll');
        await this.affixProcess(suite, result, 'beforeEach');
        await this.executeTest(consumer, test);
        await this.affixProcess(suite, result, 'afterEach');
        await this.affixProcess(suite, result, 'afterAll');
      } catch (e) {
        if (e.message === 'breakout') {
          // Done
        } else {
          throw e;
        }
      }
    } catch (e) {
      this.stubSuiteFailure(suite, e, consumer);
    }
  }

  static async executeSuite(consumer: Consumer, suite: SuiteConfig) {
    try {
      const result: SuiteResult = {
        success: 0,
        fail: 0,
        skip: 0,
        total: 0,
        lines: { ...suite.lines },
        file: suite.file,
        className: suite.className,
        tests: []
      };

      consumer.onEvent({ phase: 'before', type: 'suite', suite });

      try {
        await this.affixProcess(suite, result, 'beforeAll');

        for (const testConfig of suite.tests) {
          await this.affixProcess(suite, result, 'beforeEach');

          const ret = await this.executeTest(consumer, testConfig);
          result[ret.status]++;
          result.tests.push(ret);

          await this.affixProcess(suite, result, 'afterEach');
        }

        await this.affixProcess(suite, result, 'afterAll');
      } catch (e) {
        if (e.message === 'breakout') {
          // Done
        } else {
          throw e;
        }
      }

      consumer.onEvent({ phase: 'after', type: 'suite', suite: result });

      result.total = result.success + result.fail;

      return result as SuiteResult;
    } catch (e) {
      this.stubSuiteFailure(suite, e, consumer);
    }
  }

  static getRunParams(file: string, clsName?: string, method?: string): [SuiteConfig] | [SuiteConfig, TestConfig] | [SuiteConfig[]] {
    let res = undefined;
    if (clsName && /^\d+$/.test(clsName)) {
      const line = parseInt(clsName, 10);
      const clses = TestRegistry.getClasses().filter(f => f.__filename === file).map(x => TestRegistry.get(x));
      const cls = clses.find(x => line >= x.lines.start && line <= x.lines.end);
      if (cls) {
        const meth = cls.tests.find(x => line >= x.lines.start && line <= x.lines.end);
        if (meth) {
          res = [cls, meth];
        } else {
          res = [cls];
        }
      } else {
        res = [clses];
      }
    } else {
      if (method) {
        const cls = TestRegistry.getClasses().find(x => x.name === clsName)!;
        const clsConf = TestRegistry.get(cls);
        const meth = clsConf.tests.find(x => x.methodName === method)!;
        res = [clsConf, meth];
      } else if (clsName) {
        const cls = TestRegistry.getClasses().find(x => x.name === clsName)!;
        const clsConf = TestRegistry.get(cls);
        res = [clsConf];
      } else {
        const clses = TestRegistry.getClasses().map(x => TestRegistry.get(x))
        res = [clses];

      }
    }

    return res as any;
  }

  static async execute(consumer: Consumer, [file, ...args]: string[]) {
    if (!file.startsWith(process.cwd())) {
      file = `${process.cwd()}/${file}`;
    }

    require(file);

    await TestRegistry.init();

    const params = this.getRunParams(file, args[0], args[1]);

    const suites: SuiteConfig | SuiteConfig[] = params[0];
    const test = params[1] as TestConfig;

    if (Array.isArray(suites)) {
      for (const suite of suites) {
        await this.executeSuite(consumer, suite);
      }
    } else {
      if (test) {
        await this.executeSuiteTest(consumer, suites, test);
      } else {
        await this.executeSuite(consumer, suites);
      }
    }
  }
}