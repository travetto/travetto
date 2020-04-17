import * as os from 'os';

import { Compiler } from '@travetto/compiler';
import { RootRegistry, MethodSource, Class } from '@travetto/registry';
import { WorkPool, EventInputSource } from '@travetto/worker';

import { TestRegistry } from '../registry/registry';
import { buildWorkManager } from '../worker/parent';
import { RunEvent } from '../worker/types';
import { TestConfig, TestResult } from '../model/test';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { ConsumerRegistry } from '../consumer/registry';
import { Consumer } from '../model/consumer';
import { TestRegistryUtil } from '../registry/util';
export class TestWatcher {

  static state: Record<string, TestResult['status']> = {};

  static getConf(o?: Class): SuiteConfig | undefined;
  static getConf(o?: [Class, Function]): TestConfig | undefined;
  static getConf(o?: [Class, Function] | Class) {
    if (o) {
      if (Array.isArray(o)) {
        const [cls, method] = o;
        if (TestRegistry.has(cls)) {
          const conf = TestRegistry.get(cls);
          if (method) {
            return conf.tests.find(x => x.methodName === method.name);
          } else {
            return conf;
          }
        }
      } else {
        return TestRegistry.get(o);
      }
    }
  }

  static summarizeSuite(test: TestResult): SuiteResult {
    require(test.file);

    this.state[`${test.classId}!${test.methodName}`] = test.status;
    const SuiteCls = TestRegistry.getClasses().find(x =>
      x.__id === test.classId
    )!;

    const suite = TestRegistry.get(SuiteCls);
    const total = suite.tests.reduce((acc, x) => {
      const status = this.state[`${x.classId}!${x.methodName}`] ?? 'unknown';
      acc[status] += 1;
      return acc;
    }, { skip: 0, success: 0, fail: 0, unknown: 0 });

    return {
      classId: suite.classId,
      success: total.success,
      fail: total.fail,
      skip: total.skip,
      file: suite.file,
      lines: suite.lines,
      total: total.fail + total.success,
      tests: [],
      duration: 0
    };
  }

  static async watch(format: string) {
    console.debug('Listening for changes');

    const src = new EventInputSource<RunEvent>();

    await TestRegistry.init();
    TestRegistry.listen(RootRegistry);

    const ConsumerCls = ConsumerRegistry.get(format)!;
    const hidden = new ConsumerCls();

    const consumer: Consumer = {
      onEvent: (e) => {
        hidden.onEvent(e);
        try {
          if (e.type === 'test' && e.phase === 'after') {
            const suite = this.summarizeSuite(e.test);
            hidden.onEvent({
              type: 'suite',
              phase: 'after',
              suite
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: os.cpus.length - 1
    });

    const methods = new MethodSource(TestRegistry);

    // RootRegistry.on(e => {
    //   const conf = this.getConf(e.prev ?? e.curr);
    //   if (!conf) { return; }

    //   switch (e.type) {
    //     case 'added': case 'changed': {
    //       src.trigger({
    //         file: conf.file,
    //         class: conf.class.name
    //       });
    //       break;
    //     }
    //   }
    // });

    Compiler.presenceManager.addNewFolder(`test`);


    setTimeout(() => {
      methods.on(e => {
        const conf = this.getConf(e.prev ?? e.curr);
        if (!conf) { return; }

        switch (e.type) {
          case 'added': case 'changed': {
            src.trigger({
              method: conf.methodName,
              file: conf.file,
              class: conf.class.name
            }, true); // Shift to front
            break;
          }
          case 'removing': {
            /**
             *
             */
          }
        }
      });
    }, 100);
    await pool
      .process(src)
      .finally(() => pool.shutdown());
  }
}