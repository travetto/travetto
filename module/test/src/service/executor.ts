import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { Readable } from 'stream';

import { bulkFind } from '@encore2/base';
import { TestRegistry } from './registry';
import { SuiteConfig, TestConfig, TestResult, SuiteResult, AllSuitesResult, Counts } from '../model';
import { Listener, ListenEvent } from './listener';
import { AgentPool, Agent } from './agent';

const COMMAND = path.dirname(path.dirname(__dirname)) + '/bootstrap-worker.js';
export class Executor {

  timeout = 5000;
  pending = new Map<number, Promise<{ jobId: number, agent: Agent }>>();
  agentPool = new AgentPool(COMMAND);

  isTest(file: string) {
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

  async getTests(globs: string[]) {
    let files = await bulkFind(globs);
    let all = await Promise.all(files.map(async (f) => [f, await this.isTest(f)] as [string, boolean]));
    return all.filter(x => x[1]).map(x => x[0]);
  }

  checkError(test: TestConfig, err: Error | string) {
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

  async executeTest(test: TestConfig) {
    let suite = TestRegistry.get(test.class);
    let result: Partial<TestResult> = {
      method: test.method,
      description: test.description,
      suiteName: test.suiteName,
      status: 'skipped'
    };

    if (test.skip) {
      return result as TestResult;
    }

    try {
      let timeout = new Promise((_, reject) => setTimeout(reject, this.timeout).unref());
      let res = await Promise.race([suite.instance[test.method](), timeout]);
      result.status = 'passed';
    } catch (err) {
      err = this.checkError(test, err);
      if (!err) {
        result.status = 'passed';
      } else {
        result.status = 'failed';
        result.error = err;
      }
    }

    return result as TestResult;
  }

  async executeSuite(suite: SuiteConfig) {
    let result: SuiteResult = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      file: suite.class.__filename,
      class: suite.class.name,
      name: suite.name,
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

  async executeFile(file: string) {
    require(`${process.cwd()}/${file}`);

    await TestRegistry.init();

    let classes = TestRegistry.getClasses();

    for (let cls of classes) {
      let suite = TestRegistry.get(cls);

      if (process.send) {
        process.send({ phase: 'before', type: 'suite', suite });
      }

      let result = await this.executeSuite(suite);

      if (process.send) {
        process.send({ phase: 'after', type: 'suite', suite: result });
      }
    }
  }

  executeRunner(jobId: number, agent: Agent, file: string, listeners: Listener[]) {
    return new Promise<{ jobId: number, agent: Agent }>(async (resolve, reject) => {

      for (let l of listeners) {
        agent.listen(l.onEvent.bind(l));
      }

      agent.listen('runComplete', e => {
        for (let l of listeners) {
          agent.removeListener(l.onEvent);
        }
        if (e.success) {
          resolve({ jobId, agent });
        } else {
          console.error('Error', e.error);
          reject(new Error(e.error));
        }
      });

      agent.send('run', { file, jobId });
    });
  }

  async execute(globs: string[], listeners: Listener[] = []) {
    let files = await this.getTests(globs);

    files = files.map(x => x.split(process.cwd() + '/')[1]);

    let position = 0;
    while (position < files.length) {
      if (this.pending.size < this.agentPool.availableSize) {
        let next = position++;
        let agent = await this.agentPool.getNextAgent();
        this.pending.set(next, this.executeRunner(next, agent!, files[next], listeners));
      } else {
        let { jobId, agent } = await Promise.race(this.pending.values());
        this.pending.delete(jobId);
        this.agentPool.returnAgent(agent);
      }
    }

    await Promise.all(this.pending.values());
  }
}
