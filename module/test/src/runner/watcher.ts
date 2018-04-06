import * as util from 'util';
import * as fs from 'fs';

import { TestRegistry } from '../service';
import { RootRegistry, MethodSource, Class } from '@travetto/registry';
import { TestConfig } from '../model';
import { ExecutionEmitter, Consumer } from '../consumer';
import { QueueDataSource, ChildExecution } from '@travetto/exec';
import { client, Events } from './communication';
import { bulkRequire } from '@travetto/base';

function getConf(o?: [Class, Function]) {
  if (o) {
    const [cls, method] = o;
    if (TestRegistry.has(cls)) {
      const conf = TestRegistry.get(cls).tests.find(x => x.method === method.name);
      return conf;
    }
  }
}

function send(e: string, data: { file: string } & { [key: string]: any }) {
  if (process.send) {
    process.send({ type: e, ...data });
  } else {
    console.log('SENDING', JSON.stringify({ type: e, ...data }));
  }
}

export async function watch() {
  console.log('Listening for changes');
  TestRegistry.listen(RootRegistry);

  const queue: TestConfig[] = [];

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
        file: e.curr!.__filename,
        class: e.curr!.__id
      });
    } else if (e.type === 'removing') {
      send('suite-removed', {
        file: e.prev!.__filename,
        class: e.prev!.__id
      });
    }
  });

  const methods = new MethodSource(TestRegistry);
  await TestRegistry.init();

  methods.on(e => {
    const conf = getConf(e.prev || e.curr);

    if (!conf) { return; }

    if (e.type === 'added' || e.type === 'changed') {
      send('test-changed', {
        method: conf.method,
        file: conf.file,
        class: conf.class.__id
      });
      queue.push(conf);
    } else if (e.type === 'removing') {
      send('test-removed', {
        method: conf.method,
        file: conf.file,
        class: conf.class.__id
      });
    }
  });

  const all = client().process(
    new QueueDataSource(queue),
    async (conf, exe: ChildExecution) => {
      exe.listen(consumer.onEvent.bind(consumer));
      const complete = exe.listenOnce(Events.RUN_COMPLETE);
      exe.send(Events.RUN_TEST, {
        file: conf.file,
        class: conf.class.__id,
        method: conf.method
      });
      const { error } = await complete;
    }
  );

  bulkRequire('test/**/*.ts');

  console.log('Waiting');

  await all;
}