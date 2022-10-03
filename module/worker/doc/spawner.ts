import { WorkPool, WorkUtil, IterableWorkSet } from '@travetto/worker';
import { PathUtil } from '@travetto/boot';
import { ModuleUtil } from '@travetto/boot/src/internal/module-util';

export async function main(): Promise<void> {
  const pool = new WorkPool(() =>
    WorkUtil.spawnedWorker<{ data: string }, string>(
      () => ModuleUtil.forkMain(PathUtil.resolveUnix(__dirname, 'spawned.ts')),
      ch => ch.once('ready'), // Wait for child to indicate it is ready
      async (channel, inp) => {
        const res = channel.once('response'); //  Register response listener
        channel.send('request', { data: inp }); // Send request

        const { data } = await res; // Get answer
        console.log('Request complete', { input: inp, output: data });

        if (!(inp + inp === data)) {
          // Ensure the answer is double the input
          throw new Error('Did not get the double');
        }
      }
    )
  );

  await pool.process(new IterableWorkSet([1, 2, 3, 4, 5])).then(x => pool.shutdown());
}