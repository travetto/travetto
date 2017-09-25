import * as fs from 'fs';
import * as readline from 'readline';
import { bulkFind } from '@encore2/base';

import { TestConfig, TestResult, SuiteConfig, SuiteResult } from '../model';
import { TestRegistry } from '../service';
import { ListenEvent } from './listener';
import { ConsoleCapture } from './console';
import { AssertUtil } from './assert';

export interface TestEmitter {
  emit(event: ListenEvent): void;
}

export class TestUtil {

  static timeout = 5000;

  static isTest(file: string) {
    return new Promise<boolean>((resolve, reject) => {
      let input = fs.createReadStream(file);
      let reader = readline.createInterface({ input })
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
    let files = await bulkFind(globs);
    let all = await Promise.all(files.map(async (f) => [f, await this.isTest(f)] as [string, boolean]));
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

  static async executeTest(test: TestConfig) {
    let suite = TestRegistry.get(test.class);
    let result: Partial<TestResult> = {
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
      AssertUtil.start();

      let timeout = new Promise((_, reject) => setTimeout(reject, this.timeout).unref());
      let res = await Promise.race([suite.instance[test.method](), timeout]);
      result.status = 'success';
    } catch (err) {
      err = this.checkError(test, err);
      if (!err) {
        result.status = 'success';
      } else {
        result.status = 'fail';
        result.error = JSON.parse(JSON.stringify(err));
      }
    } finally {
      result.output = ConsoleCapture.end();
      result.assertions = AssertUtil.end();
    }

    return result as TestResult;
  }

  static async executeSuite(suite: SuiteConfig, emitter?: TestEmitter) {
    let result: SuiteResult = {
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

    for (let before of suite.beforeAll) {
      await suite.instance.call(before);
    }

    for (let test of suite.tests) {
      if (emitter) {
        emitter.emit({ type: 'test', phase: 'before', test });
      }

      for (let before of suite.beforeEach) {
        await suite.instance.call(before);
      }

      let ret = await this.executeTest(test);
      result[ret.status]++;
      result.tests.push(ret);

      if (emitter) {
        emitter.emit({ type: 'test', phase: 'after', test: ret });
      }

      for (let after of suite.afterEach) {
        await suite.instance.call(after);
      }
    }

    for (let after of suite.afterAll) {
      await suite.instance.call(after);
    }

    result.total = result.success + result.fail;

    return result as SuiteResult;
  }

  static async executeFile(file: string, emitter?: TestEmitter) {
    require(`${process.cwd()}/${file}`);

    await TestRegistry.init();

    let classes = TestRegistry.getClasses();

    for (let cls of classes) {
      let suite = TestRegistry.get(cls);

      if (emitter) {
        emitter.emit({ phase: 'before', type: 'suite', suite });
      }

      let result = await this.executeSuite(suite, emitter);

      if (emitter) {
        emitter.emit({ phase: 'after', type: 'suite', suite: result });
      }
    }
  }
}