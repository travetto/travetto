import { ShutdownManager } from '../src/shutdown';
import { StacktraceManager } from '../src/stacktrace';

/**
 * Registers stack trace handler for non-prod
 * And prepare shutdown manager
 */
export const step = {
  key: '@trv:base/init',
  action: (): void => {
    StacktraceManager.init();
    ShutdownManager.register();
  }
};