import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { exec } from '@encore2/util';
import { bulkFind } from '@encore2/base';
import { TestRegistry } from './registry';
import { SuiteConfig, TestConfig, TestResult, SuiteResult, SuitesResult, Counts } from '../model';

interface SpawnFile {
  id: number;
  results: SuitesResult;
}

const COMMAND = path.dirname(path.dirname(__dirname)) + '/runner.js';

const BASE_COUNT: Counts = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0
}

export class Executor {

  static timeout = 5000;
  static executors = os.cpus().length - 1;
  static pending: Map<number, Promise<SpawnFile>>;

  static isTest(file: string) {
    return new Promise<boolean>((resolve, reject) => {
      let reader = readline.createInterface({
        input: fs.createReadStream(file)
      }).on('line', line => {
        if (line.includes('@Suite')) {
          reader.close();
          resolve(true);
        }
      }).on('end', () => {
        resolve(false);
      });
    });
  }

  static async getTests(globs: string[]) {
    let files = await bulkFind(globs);
    let all = await Promise.all(files.map(async (f) => [f, await this.isTest(f)] as [string, boolean]));
    return all.filter(x => x[1]).map(x => x[0]);
  }

  static async executeTest(test: TestConfig) {
    let suite = TestRegistry.get(test.class);
    let result: TestResult = {
      passed: false,
      skipped: false,
      failed: false
    };

    try {
      let timeout = new Promise(resolve => setTimeout(resolve, this.timeout));
      let res = await Promise.race([suite.instance[test.method](), timeout]);
      result.passed = true;
    } catch (err) {
      result.failed = true;
      result.error = err;
    }

    return result as TestResult;
  }

  static async executeSuite(suite: SuiteConfig) {
    let result: SuiteResult = {
      ...BASE_COUNT,
      file: suite.class.__filename,
      class: suite.class.name,
      tests: []
    };

    for (let test of suite.tests) {
      let ret = await this.executeTest(test);
      if (ret.passed) {
        result.passed++;
        result.total++;
      } else if (ret.skipped) {
        result.skipped++;
      } else {
        result.total++;
        result.failed++;
      }
      result.tests.push(ret);
    }

    return result as SuiteResult;
  }

  static async executeFile(file: string) {
    await TestRegistry.init();
    let classes = TestRegistry.getClasses();
    let suiteResults = [];
    for (let cls of classes) {
      let suite = TestRegistry.get(cls);
      let result = await this.executeSuite(suite);
      suiteResults.push(result);
    }
    return suiteResults;
  }

  static async spawnFile(id: number, file: string) {
    let results = await exec(`${COMMAND} ${file}`, {
      env: {
        ...process.env,
        FORMATTER: 'json'
      }
    });
    if (results.valid) {
      const suites = JSON.parse(results.stdout) as SuitesResult;
      return { id, results: suites };
    } else {
      throw new Error(results.stderr);
    }
  }

  static async exec(globs: string[]) {
    console.debug('Globs', globs);
    let files = await this.getTests(globs);

    console.debug('Files', files);

    if (files.length === 1) {
      return this.executeFile(files[0]);
    } else {
      let results: SuitesResult = {
        ...BASE_COUNT,
        suites: []
      };

      let position = 0;
      while (position < files.length) {
        if (this.pending.size < this.executors) {
          let next = position++;
          this.pending.set(next, this.spawnFile(next, files[next]));
        } else {
          let done = await Promise.race(this.pending.values());
          results.suites.push(...done.results.suites);
          results.failed += done.results.failed;
          results.passed += done.results.passed;
          results.skipped += done.results.skipped;
          results.total += done.results.total;
          this.pending.delete(done.id);
        }
      }

      return results;
    }
  }
}
