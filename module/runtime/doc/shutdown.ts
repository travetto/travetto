import { ShutdownManager } from '@travetto/runtime';

export function registerShutdownHandler() {
  ShutdownManager.signal.addEventListener('abort', async () => {
    // Do important work, the framework will wait until all async
    //   operations are completed before finishing shutdown
  });
}