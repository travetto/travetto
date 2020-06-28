import { WorkUtil } from '../../../src/util';
import { FsUtil } from '@travetto/boot';

import { WorkPool } from '../../../src/pool';
import { IterableInputSource } from '../../../src/input/iterable';

const pool = new WorkPool(() =>
  WorkUtil.spawnedWorker<string>(FsUtil.resolveUnix(__dirname, 'spawned.js'), {
    handlers: {
      async init(channel) {
        return channel.listenOnce('ready'); // Wait for child to indicate it is ready
      },
      async execute(channel, inp) {
        const res = channel.listenOnce('response'); //  Register response listener
        channel.send('request', { data: inp }); // Send request

        const { data } = await res; // Get answer
        console.log('Sent', inp, 'Received', data);

        if (!(inp + inp === data)) {
          // Ensure the answer is double the input
          throw new Error(`Didn't get the double`);
        }
      }
    }
  })
);

pool.process(new IterableInputSource([1, 2, 3, 4, 5])).then(x => pool.shutdown());