import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';

import { exec } from '@encore2/util';
import { bulkFind } from '@encore2/base';
import { TestRegistry } from './registry';
import { SuiteConfig, TestConfig, TestResult, SuiteResult, SuitesResult, Counts } from '../model';

interface SpawnFile {
  id: number;
  results: SuitesResult;
}

type ExecEvent = {
  type: 'test',
  phase: 'before',
  test: TestConfig
} | {
    type: 'test',
    phase: 'after',
    test: TestResult
  } | {
    type: 'suite',
    phase: 'before',
    suite: SuiteConfig
  } | {
    type: 'suite',
    phase: 'after',
    suite: SuiteResult
  } | {
    type: 'suites',
    phase: 'after',
    suites: SuitesResult
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
  static pending = new Map<number, Promise<SpawnFile>>();

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

  static async executeTest(test: TestConfig) {
    let suite = TestRegistry.get(test.class);
    let result: Partial<TestResult> = {
      method: test.method,
      description: test.description
    };

    try {
      let timeout = new Promise((_, reject) => setTimeout(reject, this.timeout).unref());
      let res = await Promise.race([suite.instance[test.method](), timeout]);
      result.status = 'passed';
    } catch (err) {
      result.status = 'failed';
      result.error = err;
    }

    return result as TestResult;
  }

  static async executeSuite(suite: SuiteConfig) {
    let result: SuiteResult = {
      ...BASE_COUNT,
      file: suite.class.__filename,
      class: suite.class.name,
      description: suite.description,
      tests: []
    };

    for (let test of suite.tests) {
      if (process.send) {
        process.send({ type: 'test', phase: 'before', test });
      }

      let ret = await this.executeTest(test);

      switch (ret.status) {
        case 'passed':
          result.passed++;
          result.total++;
          break;
        case 'failed':
          result.total++;
          result.failed++;
          break;
        case 'skipped':
          result.skipped++;
      }
      result.tests.push(ret);

      if (process.send) {
        process.send({ type: 'test', phase: 'after', test: ret });
      }
    }

    return result as SuiteResult;
  }

  static async executeFile(file: string) {
    require(`${process.cwd()}/${file}`);

    await TestRegistry.init();

    let classes = TestRegistry.getClasses();

    let suiteResults: SuitesResult = {
      ...BASE_COUNT,
      suites: []
    };

    for (let cls of classes) {
      let suite = TestRegistry.get(cls);

      if (process.send) {
        process.send({ phase: 'before', type: 'suite', suite });
      }

      let result = await this.executeSuite(suite);

      this.merge(suiteResults, result);

      if (process.send) {
        process.send({ phase: 'after', type: 'suite', suite: result });
      }
    }

    if (process.send) {
      process.send({ phase: 'after', type: 'suites', suites: suiteResults });
    }

    return suiteResults;
  }

  static async spawnFile(id: number, file: string) {

    let [spawned, sub] = exec(`${COMMAND} ${file}`, {
      env: {
        ...process.env,
        FORMATTER: 'noop'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      exposeProcess: true
    });

    let tests: TestResult[] = [];
    let suites: SuiteResult[] = [];
    let allSuites: SuitesResult;

    sub.on('message', (e: ExecEvent) => {
      if (e.phase === 'after') {
        switch (e.type) {
          case 'suite': suites.push(e.suite); break;
          case 'test': tests.push(e.test); break;
          case 'suites': allSuites = e.suites; break;
        }
      } else {
        console.log('Running', e.type, e.type === 'test' ? e.test.method : e.suite.className);
      }
    });

    let results = await spawned;

    if (results.valid) {
      return { id, results: allSuites! };
    } else {
      throw new Error(results.stderr);
    }
  }

  static merge(dest: SuitesResult, src: SuitesResult | SuiteResult) {
    if ('suites' in src) {
      dest.suites.push(...(src as SuitesResult).suites);
    } else {
      dest.suites.push(src as SuiteResult);
    }
    dest.failed += src.failed;
    dest.passed += src.passed;
    dest.skipped += src.skipped;
    dest.total += src.total;
  }

  static async exec(globs: string[]) {
    let files = await this.getTests(globs);

    files = files.map(x => x.split(process.cwd() + '/')[1]);

    if (files.length === 1) {
      let single = await this.executeFile(files[0]);
      if (process.send) {
        process.exit(0);
      }
      return single;
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
          this.merge(results, done.results);
          this.pending.delete(done.id);
        }
      }

      let final = await Promise.all(this.pending.values());
      for (let done of final) {
        this.merge(results, done.results);
      }

      return results;
    }
  }
}
