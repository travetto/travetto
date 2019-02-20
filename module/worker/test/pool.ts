import { FsUtil } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { WorkerIteratorInputSource, WorkerPool, Worker } from '../';

@Suite()
export class PoolExecTest {

  @Test()
  async simple() {

    const pool = new WorkerPool<Worker>(async () => {
      console.log('Initializing child');
      const child = new Worker(FsUtil.resolveUnix(__dirname, 'simple.child-launcher.js'), [], true, {
        env: { SRC: './simple.child' }
      });
      child.init();
      await child.listenOnce('ready');
      console.log('Child ready');
      return child;

    }, { max: 1 });

    await pool.process(
      //  new ArrayExecutionSource(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
      new WorkerIteratorInputSource(function* () {
        for (let i = 0; i < 5; i++) {
          yield `${i}-`;
        }
      }),
      async (i: string, exe: Worker) => {
        const res = exe.listenOnce('response');
        exe.send('request', { data: i });
        const { data } = await res;
        console.log('Sent', i, 'Received', data);
        await new Promise(r => setTimeout(r, 100));
      }
    );

    await pool.shutdown();
  }
}