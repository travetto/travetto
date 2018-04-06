import * as fs from 'fs';
import * as readline from 'readline';
import * as assert from 'assert';
import { bulkFind } from '@travetto/base';

import { TestConfig, TestResult, SuiteConfig, SuiteResult, Assertion } from '../model';
import { TestRegistry } from '../service';
import { ConsoleCapture } from './console';
import { AssertUtil } from './assert';
import { Consumer } from '../consumer';

export class ExecuteUtil {

  static timeout = 5000;

  static async affixProcess(suite: SuiteConfig, result: SuiteResult, phase: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach') {
    try {
      for (const fn of suite[phase]) {
        await fn.call(suite.instance);
      }
    } catch (error) {
      const { line, file } = AssertUtil.readFilePosition(error, suite.class.__filename);
      result.tests.push({
        status: 'fail',
        suiteName: suite.name,
        method: phase,
        description: phase,
        line,
        lineEnd: line,
        file,
        error,
        assertions: [],
        output: {}
      } as TestResult);
      throw new Error('breakout');
    }
  }

  static async stubSuiteFailure(suite: SuiteConfig, e: Error, consumer?: Consumer) {
    if (!consumer) {
      return;
    }

    const test = {
      line: suite.line,
      lineEnd: suite.lineEnd,
      suiteName: suite.name,
      status: 'fail',
      method: 'all',
      error: e,
      output: { error: e.stack },
      assertions: [{
        error: e,
        line: suite.line,
        message: e.message,
        file: suite.class.__filename,
        operator: 'throws',
        text: '(init)'
      }],
      class: suite.class.name,
      description: '',
      file: suite.class.__filename
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

  static async executeTest(test: TestConfig, consumer: Consumer) {

    consumer.onEvent({ type: 'test', phase: 'before', test });

    const suite = TestRegistry.get(test.class);
    const result: Partial<TestResult> = {
      method: test.method,
      description: test.description,
      suiteName: test.suiteName,
      line: test.line,
      lineEnd: test.lineEnd,
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
      const res = await Promise.race([suite.instance[test.method](), timeout]);
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

  static async executeSuite(suite: SuiteConfig, consumer: Consumer) {
    try {
      const result: SuiteResult = {
        success: 0,
        fail: 0,
        skip: 0,
        total: 0,
        line: suite.line,
        lineEnd: suite.lineEnd,
        file: suite.class.__filename,
        class: suite.class.name,
        name: suite.name,
        tests: []
      };

      consumer.onEvent({ phase: 'before', type: 'suite', suite });

      try {
        await this.affixProcess(suite, result, 'beforeAll');

        for (const test of suite.tests) {
          await this.affixProcess(suite, result, 'beforeEach');

          const ret = await this.executeTest(test, consumer);
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

  static require(file: string) {
    require(file.indexOf(process.cwd()) === 0 ? file : `${process.cwd()}/${file}`);
  }

  static async execute(consumer: Consumer, file: string, clsName?: string, method?: string) {
    this.require(file);
    await TestRegistry.init();

    if (method) {
      const cls = TestRegistry.getClasses().find(x => x.name === clsName)!;
      const config = TestRegistry.get(cls).tests.find(x => x.method === method)!;
      await this.executeTest(config, consumer);
    } else if (clsName) {
      const cls = TestRegistry.getClasses().find(x => x.name === clsName)!;
      const conf = TestRegistry.get(cls);
      await this.executeSuite(conf, consumer);
    } else {
      const classes = TestRegistry.getClasses();
      for (const cls of classes) {
        const suite = TestRegistry.get(cls);
        await this.executeSuite(suite, consumer);
      }
    }
  }
}
