import { Env } from '../src/env';
import { ShutdownManager } from '../src/shutdown';
import { StacktraceUtil } from '../src/stacktrace';

/**
 * Registers stack trace handler for non-prod
 * And prepare shutdown manager
 */
export const init = {
  key: 'base',
  action: () => {
    if (Env.prod) {
      process.env.NODE_ENV = 'production';
    } else {
      StacktraceUtil.initHandler();
    }
    StacktraceUtil.clearStackFilters(); // @line-if $TRV_DEV
    ShutdownManager.register();
  }
};