import * as os from 'os';

import { Compiler } from '@travetto/compiler';
import { RootRegistry, MethodSource, Class } from '@travetto/registry';
import { WorkPool, EventInputSource } from '@travetto/worker';

import { TestRegistry } from '../registry/registry';
import { buildWorkManager } from '../worker/parent';
import { RunEvent } from '../worker/types';
import { TestConfig } from '../model/test';
import { SuiteConfig } from '../model/suite';
import { ConsumerRegistry } from '../consumer/registry';

export class TestWatcher {

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

  static async watch(format: string) {
    console.debug('Listening for changes');

    const src = new EventInputSource<Omit<RunEvent, 'type'>>();

    await TestRegistry.init();
    TestRegistry.listen(RootRegistry);

    const consumer = ConsumerRegistry.get(format)!;

    const pool = new WorkPool(buildWorkManager.bind(null, new consumer()), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: os.cpus.length - 1
    });

    const methods = new MethodSource(TestRegistry);

    RootRegistry.on(e => {
      const conf = this.getConf(e.prev ?? e.curr);
      if (!conf) { return; }

      switch (e.type) {
        case 'added': case 'changed': {
          src.trigger({
            file: conf.file,
            class: conf.class.name
          });
          break;
        }
      }
    });

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