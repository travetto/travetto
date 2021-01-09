import { ShutdownManager } from '@travetto/base';

export function registerShutdownHandler() {
  ShutdownManager.onShutdown('handler-name', async () => {
    // Do important work, the framework will wait until all async
    //   operations are completed before finishing shutdown
  });
}