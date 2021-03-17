import { WorkPool, WorkUtil, IterableInputSource } from '@travetto/worker';
import { ExecUtil, PathUtil } from '@travetto/boot';

const pool = new WorkPool(() =>
  WorkUtil.spawnedWorker<{ data: string }, string>(
    () => ExecUtil.forkMain(PathUtil.resolveUnix(__dirname, 'spawned.ts')),
    ch => ch.listenOnce('ready'), // Wait for child to indicate it is ready    
    async (channel, inp) => {
      const res = channel.listenOnce('response'); //  Register response listener
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

export function main() {
  return pool.process(new IterableInputSource([1, 2, 3, 4, 5])).then(x => pool.shutdown());
}