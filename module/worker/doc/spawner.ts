import { WorkPool, WorkUtil, IterableInputSource } from '@travetto/worker';
import { FsUtil } from '@travetto/boot';

const pool = new WorkPool(() =>
  WorkUtil.spawnedWorker<{ data: string }, string>(FsUtil.resolveUnix(__dirname, 'spawned.js'), {
    handlers: {
      async init(channel) {
        return channel.listenOnce('ready'); // Wait for child to indicate it is ready
      },
      async execute(channel, inp) {
        const res = channel.listenOnce('response'); //  Register response listener
        channel.send('request', { data: inp }); // Send request

        const { data } = await res; // Get answer
        console.log('Request complete', { input: inp, output: data });

        if (!(inp + inp === data)) {
          // Ensure the answer is double the input
          throw new Error(`Didn't get the double`);
        }
      }
    }
  })
);

if (process.argv.pop() === 'top') {
  pool.process(new IterableInputSource([1, 2, 3, 4, 5])).then(x => pool.shutdown());
}