import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { ExecUtil } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';

import { WorkPool } from '../src/pool';
import { WorkUtil } from '../src/util';

@Suite()
export class PoolExecTest {

  fixtures = new TestFixtures();

  @Test()
  async simple() {

    const input = function* () {
      for (let i = 0; i < 5; i++) {
        yield `${i}-`;
      }
    };

    const launcher = await this.fixtures.resolve('/simple.child.mjs');

    await WorkPool.run(
      () => WorkUtil.spawnedWorker<{ data: string }, string>(
        () => ExecUtil.fork(launcher, [], { cwd: RuntimeIndex.outputRoot }),
        ch => ch.once('ready'),
        async (channel, inp: string) => {
          const res = channel.once('response');
          channel.send('request', { data: inp });

          const { data } = await res;
          console.log('Request Complete', { input: inp, output: data });

          assert(inp + inp === data);
        }),
      input()
    );
  }
}