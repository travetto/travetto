import { ShutdownManager } from '../src/shutdown';
import { StacktraceUtil } from '../src/stacktrace';

/**
 * Registers stack trace handler for non-prod
 * And prepare shutdown manager
 */
export const init = {
  key: '@trv:base/init',
  action: () => {
    StacktraceUtil.init();
    ShutdownManager.register();
  }
};