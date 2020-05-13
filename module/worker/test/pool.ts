import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { WorkPool } from '../src/pool';
import { IterableInputSource } from '../src/input/iterable';
import { WorkUtil } from '../src/util';

@Suite()
export class PoolExecTest {

  @Test()
  async simple() {

    // new IterableInputSource(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
    const input = new IterableInputSource(function* () {
      for (let i = 0; i < 5; i++) {
        yield `${i}-`;
      }
    });

    const pool = new WorkPool(() =>
      WorkUtil.spawnedWorker<string>({
        command: ResourceManager.toAbsolutePathSync('simple.child-launcher.js'),
        fork: true,
        init: channel => channel.listenOnce('ready'),
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