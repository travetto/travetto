import * as fs from 'fs';
import * as readline from 'readline';
import * as assert from 'assert';
import { bulkFind, BaseError } from '@travetto/base';

import { TestConfig, TestResult, SuiteConfig, SuiteResult, Assertion } from '../model';
import { TestRegistry } from '../service';
import { ConsoleCapture } from './console';
import { AssertUtil } from './assert';
import { Consumer } from '../consumer';
import { SuitePhase } from '..';

export const BREAKOUT = Symbol('breakout');
export const TIMEOUT = Symbol('timeout');

export class ExecuteUtil {

  static timeout = parseInt(process.env.DEFAULT_TIMEOUT || '5000', 10);

  static asyncTimeout(duration?: number): [Promise<any>, Function] {
    let id: NodeJS.Timer;
    const prom = new Promise((_, reject) => {
      id = setTimeout(() => reject(TIMEOUT), duration || this.timeout);
      id.unref()
    });
    return [prom, () => clearTimeout(id)];
  }

  static async generateSuiteError(consumer: Consumer, suite: SuiteConfig, methodName: string, error: Error) {
    // tslint:disable:prefer-const
    let { line, file } = AssertUtil.readFilePosition(error, suite.file);
    if (line === 1) {
      line = suite.lines.start;
    }
    const badAssert: Assertion = {
      line,
      file,
      error,
      className: suite.className,
      methodName,
      message: error.message,
      text: methodName,
      operator: 'throws'
    };
    const badTest: TestResult = {
      status: 'fail',
      className: suite.className,
      methodName,
      description: methodName,
      lines: { start: line, end: line },
      file,
      error,
      assertions: [badAssert],
      output: {}
    };

    const badTestConfig: TestConfig = {
      class: suite.class,
      className: suite.className,
      file: suite.file,
      lines: badTest.lines,
      methodName: badTest.methodName,
      description: badTest.description,
      skip: false
    };

    consumer.onEvent({ type: 'test', phase: 'before', test: badTestConfig });
    consumer.onEvent({ type: 'assertion', phase: 'after', assertion: badAssert });
    consumer.onEvent({ type: 'test', phase: 'after', test: badTest });

    return badTest;
  }

  static async affixProcess(consumer: Consumer, phase: SuitePhase, suite: SuiteConfig, result: SuiteResult) {
    try {
      for (const fn of suite[phase]) {
        const [timeout, clear] = this.asyncTimeout();
        await Promise.race([timeout, fn.call(suite.instance)]);
        clear();
      }
    } catch (error) {
      if (error === TIMEOUT) {
        error = new Error(`${suite.className}: ${phase} timed out`);
      }
      const res = await this.generateSuiteError(consumer, suite, `[[${phase}]]`, error);
      result.tests.push(res);
      result.fail++;
      throw BREAKOUT;
    }
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

  static checkError(test: TestConfig, err: Error | string | undefined) {
    if (test.shouldError && test.shouldError) {
      if (typeof test.shouldError === 'boolean') {
        if (err && !test.shouldError) {
          throw new Error('Expected an error to not be thrown');
        } else if (!err && test.shouldError) {
          throw new Error('Expected an error to be thrown');
        }
        return;
      } else if (typeof test.shouldError === 'string') {
        if (err === undefined || !(err instanceof Error ? err.message : err).includes(test.shouldError)) {
          return new Error(`Expected error containing text ${test.shouldError}`);
        } else {
          return;
        }
      } else if (test.shouldError instanceof RegExp) {
        if (err !== undefined && test.shouldError.test(typeof err === 'string' ? err : err.message)) {
          return;
        } else {
          return new Error(`Expected error with message matching ${test.shouldError.source}`);
        }
      } else if (test.shouldError === Error || Object.getPrototypeOf(test.shouldError).constructor !== Function) { // if not simple function, treat as class
        if (!err || !(err instanceof test.shouldError)) {
          return new Error(`Expected to throw ${test.shouldError.name}`);
        } else {
          return;
        }
      } else if (test.shouldError(err)) {
        return;
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

    const [timeout, clear] = this.asyncTimeout(test.timeout);

    try {
      ConsoleCapture.start();

      AssertUtil.start(test, (a) => {
        consumer.onEvent({ type: 'assertion', phase: 'after', assertion: a });
      });

      const res = await Promise.race([suite.instance[test.methodName](), timeout]);

      // Ensure nothing was meant to be caught
      throw undefined;

    } catch (err) {
      if (err === TIMEOUT) {
        err = new Error('Operation timed out');
      } else {
        err = this.checkError(test, err);
      }

      // If error isn't defined, we are good
      if (!err) {
        result.status = 'success';
      } else {
        result.status = 'fail';
        result.error = err;

        if (!(err instanceof assert.AssertionError)) {
          let line = AssertUtil.readFilePosition(err, test.file).line;
          if (line === 1) {
            line = test.lines.start;
          }

          const assrt = {
            className: test.className,
            error: err,
            methodName: test.methodName,
            operator: 'throws',
            message: err.message,
            file: test.file,
            text: '(uncaught)',
            line
          }
          AssertUtil.add(assrt);
        }
      }
    } finally {
      clear();
      result.output = ConsoleCapture.end();
      result.assertions = AssertUtil.end();
    }

    consumer.onEvent({ type: 'test', phase: 'after', test: result as TestResult });

    return result as TestResult;
  }

  static async executeSuiteTest(consumer: Consumer, suite: SuiteConfig, test: TestConfig) {
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
      await this.affixProcess(consumer, 'beforeAll', suite, result);
      await this.affixProcess(consumer, 'beforeEach', suite, result);
      await this.executeTest(consumer, test);
      await this.affixProcess(consumer, 'afterEach', suite, result);
      await this.affixProcess(consumer, 'afterAll', suite, result);
    } catch (e) {
      if (e !== BREAKOUT) {
        const res = await this.generateSuiteError(consumer, suite, 'all', e);
        result.tests.push(res);
        result.fail++;
      }
    }
  }

  static async executeSuite(consumer: Consumer, suite: SuiteConfig) {
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
      await this.affixProcess(consumer, 'beforeAll', suite, result);

      for (const testConfig of suite.tests) {
        await this.affixProcess(consumer, 'beforeEach', suite, result);

        const ret = await this.executeTest(consumer, testConfig);
        result[ret.status]++;
        result.tests.push(ret);

        await this.affixProcess(consumer, 'afterEach', suite, result);
      }

      await this.affixProcess(consumer, 'afterAll', suite, result);
    } catch (e) {
      if (e !== BREAKOUT) {
        const res = await this.generateSuiteError(consumer, suite, 'all', e);
        result.tests.push(res);
        result.fail++;
      }
    }

    consumer.onEvent({ phase: 'after', type: 'suite', suite: result });

    result.total = result.success + result.fail;

    return result as SuiteResult;
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