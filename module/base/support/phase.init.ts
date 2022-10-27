import { ShutdownManager } from '../src/shutdown';
import { ResourceManager } from '../src/resource';

/**
 * Registers stack trace handler for non-prod
 * And prepare shutdown manager
 */
export const step = {
  key: '@trv:base/init',
  action: (): void => {
    ResourceManager.init();
    ShutdownManager.register();
  }
};