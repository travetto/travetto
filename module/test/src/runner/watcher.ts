import * as os from 'os';
import * as fs from 'fs';

import { RootRegistry, MethodSource, Class } from '@travetto/registry';
import { WorkPool, QueueInputSource } from '@travetto/worker';
import { FsUtil } from '@travetto/boot';

import { TestRegistry } from '../registry/registry';
import { EventStreamer } from '../consumer/types/event';
import { buildWorkManager } from '../worker/parent';
import { RunEvent } from '../worker/types';
import { TestConfig } from '../model/test';
import { SuiteConfig } from '../model/suite';

export class TestWatcher {

  static getConf(o?: Class): SuiteConfig | undefined;
  static getConf(o?: [Class, Function]): TestConfig | undefined;
  static getConf(o?: [Class, Function] | Class) {
    if (o) {
      if (Array.isArray(o)) {
        const [cls, method] = o;
        if (TestRegistry.has(cls)) {
          const conf = TestRegistry.get(cls).tests.find(x => x.methodName === method.name);
          return conf;
        }
      } else {
        return TestRegistry.get(o);
      }
    }
  }

  static async watch() {
    console.debug('Listening for changes');
    TestRegistry.listen(RootRegistry);

    const queue: Omit<RunEvent, 'type'>[] = [];
    const enqueue = (e: any) => {
      console.debug('Queueing', e);
      queue.push(e);
    };

    await TestRegistry.init();

    const output = fs.createWriteStream(FsUtil.joinUnix(FsUtil.cwd, '.trv_test_log'), { autoClose: true, flags: 'w' });
    const consumer = new EventStreamer(output);

    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
      idleTimeoutMillis: 10000,
      min: 0,
      max: os.cpus.length - 1
    });

    const methods = new MethodSource(TestRegistry);

    RootRegistry.on(e => {
      const conf = this.getConf(e.prev ?? e.curr);
      if (!conf) { return; }

      switch (e.type) {
        case 'added': case 'changed': {
          enqueue({
            file: conf.file,
            class: conf.class.__id
          });
          break;
        }
      }
    });

    methods.on(e => {
      const conf = this.getConf(e.prev ?? e.curr);
      if (!conf) { return; }

      switch (e.type) {
        case 'added': case 'changed': {
          enqueue({
            method: conf.methodName,
            file: conf.file,
            class: conf.class.__id
          });
          break;
        }
        case 'removing': {
          /**
           *
           */
        }
      }
    });

    await pool
      .process(new QueueInputSource(queue))
      .finally(() => pool.shutdown());
  }
}