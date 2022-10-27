import { ShutdownManager } from '../src/shutdown';

/**
 * Registers stack trace handler for non-prod
 * And prepare shutdown manager
 */
export const step = {
  key: '@trv:base/init',
  action: (): void => {
    ShutdownManager.register();
  }
};