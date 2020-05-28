import { EnvUtil } from '@travetto/boot';

import { ShutdownManager } from '../src/shutdown';
import { StacktraceUtil } from '../src/stacktrace';

/**
 * Registers stack trace handler for non-prod
 * And prepare shutdown manager
 */
export const init = {
  key: 'base',
  action: () => {
    if (!EnvUtil.isProd()) {
      StacktraceUtil.initHandler();
    }
    Error.stackTraceLimit = 100; // @line-if $TRV_DEV
    StacktraceUtil.clearStackFilters(); // @line-if $TRV_DEV
    ShutdownManager.register();
  }
};