import { RootRegistry, MethodSource, Class } from '@travetto/registry';

import { TestRegistry } from '../registry/registry';
import { TestConfig } from '../model/test';
import { SuiteConfig } from '../model/suite';
import { Consumer } from '../model/consumer';

/* eslint-disable */

function getConf(o?: [Class, Function]) {
  if (o) {
    const [cls, method] = o;
    if (TestRegistry.has(cls)) {
      const conf = TestRegistry.get(cls).tests.find(x => x.methodName === method.name);
      return conf;
    }
  }
}

function send(e: string, data: { file: string } & Record<string, any>) {
  if (process.send) {
    process.send({ type: e, ...data });
  } else {
    // console.debug('SENDING', JSON.stringify({ type: e, ...data }));
  }
}

export async function watch() {
  console.debug('Listening for changes');
  TestRegistry.listen(RootRegistry);

  const queue: (SuiteConfig | TestConfig)[] = [];

  const consumer = {
    onEvent(e) {
      if (e.type === 'assertion') {
        send('assertion', e.assertion);
      }
    }
  } as Consumer;

  TestRegistry.on(e => {
    if (e.type === 'added') {
      send('suite-added', {
        file: e.curr!.__file,
        class: e.curr!.__id
      });
      queue.push(TestRegistry.get(e.curr!));

    } else if (e.type === 'removing') {
      send('suite-removed', {
        file: e.prev!.__file,
        class: e.prev!.__id
      });
    }
  });

  await TestRegistry.init();

  setTimeout(() => {
    const methods = new MethodSource(TestRegistry);

    methods.on(e => {
      const conf = getConf(e.prev ?? e.curr);

      if (!conf) { return; }

      if (e.type === 'added' || e.type === 'changed') {
        send('test-changed', {
          method: conf.methodName,
          file: conf.file,
          class: conf.class.__id
        });
        queue.push(conf);
      } else if (e.type === 'removing') {
        send('test-removed', {
          method: conf.methodName,
          file: conf.file,
          class: conf.class.__id
        });
      }
    });
  }, 1);

  // // const all = client().process(
  // //   new QueueExecutionSource(queue),
  // //   async (conf, exe: ChildExecution<any>) => { // TODO: Type incompatibility with ExecutionEvent and TestEvent
  // //     exe.listen(consumer.onEvent.bind(consumer));
  // //     let event: any;
  // //     if (isSuite(conf)) {
  // //       event = {
  // //         type: Events.RUN,
  // //         file: conf.class.__file,
  // //         class: conf.class.name
  // //       };
  // //     } else {
  // //       event = {
  // //         type: Events.RUN,
  // //         file: conf.file,
  // //         class: conf.class.name,
  // //         method: conf.methodName
  // //       };
  // //     }
  // //     const complete = exe.listenOnce(Events.RUN_COMPLETE);
  // //     exe.send(event.type, event);

  // //     console.debug('Running test', event);
  // //     await complete;
  // //   }
  // // );

  // // ScanFs.bulkRequire('test/**/*.ts');

  // console.debug('Waiting');

  // await all;
}

function isSuite(c: any): c is SuiteConfig {
  return 'tests' in c;
}