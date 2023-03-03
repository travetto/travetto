import { ExecUtil } from '@travetto/base';
import { WorkPool, WorkUtil, IterableWorkSet } from '@travetto/worker';

export async function main(): Promise<void> {
  const pool = new WorkPool(() =>
    WorkUtil.spawnedWorker<{ data: number }, number>(
      () => ExecUtil.spawn('trv', ['main', '@travetto/worker/doc/spawned.ts']),
      ch => ch.once('ready'), // Wait for child to indicate it is ready
      async (channel, inp) => {
        const res = channel.once('response'); //  Register response listener
        channel.send('request', { data: inp }); // Send request

        const { data } = await res; // Get answer
        console.log('Request complete', { input: inp, output: data });

        if (!(inp + inp === data)) {
          // Ensure the answer is double the input
          throw new Error(`Did not get the double: inp=${inp}, data=${data}`);
        }
      }
    )
  );
  await pool.process(new IterableWorkSet([1, 2, 3, 4, 5]));
}