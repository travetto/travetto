import { ResourceManager } from '../src/resource';
import { ShutdownManager } from '../src/shutdown';

/**
 * Registers resource managers
 * And prepare shutdown manager
 */
export const step = {
  key: '@trv:base/init',
  after: ['@trv:boot/load'],
  action: async (): Promise<void> => {
    await ResourceManager.init();
    ShutdownManager.register();
  }
};