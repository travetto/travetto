import * as assert from 'assert';

import { FsUtil } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { WorkPool } from '../src/pool';
import { IteratorInputSource } from '../src/input/iterator';
import { WorkUtil } from '../src/util';

@Suite()
export class PoolExecTest {

  @Test()
  async simple() {

    // new ArrayInputSource(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
    const input = new IteratorInputSource(function* () {
      for (let i = 0; i < 5; i++) {
        yield `${i}-`;
      }
    });

    const pool = new WorkPool(() =>
      WorkUtil.spawnedWorker<string>({
        command: FsUtil.resolveUnix(__dirname, 'simple.child-launcher.js'),
        fork: true,
        async init(channel) {
          return channel.listenOnce('ready');
        },
        async execute(channel, inp) {
          const res = channel.listenOnce('response');
          channel.send('request', { data: inp });

          const { data } = await res;
          console.log('Sent', inp, 'Received', data);

          assert(inp + inp === data);
        }
      })
    );

    await pool.process(input);
    await pool.shutdown();
  }
}