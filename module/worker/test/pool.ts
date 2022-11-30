import assert from 'assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { ExecUtil } from '@travetto/base';
import { ModuleIndex } from '@travetto/boot';

import { WorkPool } from '../src/pool';
import { IterableWorkSet } from '../src/input/iterable';
import { WorkUtil } from '../src/util';

@Suite()
export class PoolExecTest {

  fixtures = new TestFixtures();

  @Test()
  async simple() {

    // new IterableWorkSet(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
    const input = new IterableWorkSet(function* () {
      for (let i = 0; i < 5; i++) {
        yield `${i}-`;
      }
    });

    const launcher = await this.fixtures
      .queryFirst(file => file.endsWith('simple.child.mjs'))
      .then(rel => this.fixtures.describe(rel!));

    const pool = new WorkPool(() =>
      WorkUtil.spawnedWorker<{ data: string }, string>(
        () => ExecUtil.fork(launcher.path, [], { cwd: ModuleIndex.root }),
        ch => ch.once('ready'),
        async (channel, inp: string) => {
          const res = channel.once('response');
          channel.send('request', { data: inp });

          const { data } = await res;
          console.log('Request Complete', { input: inp, output: data });

          assert(inp + inp === data);
        })
    );

    await pool.process(input);
    await pool.shutdown();
  }
}