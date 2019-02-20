import { FsUtil } from '@travetto/base';

export const Events = {
  RUN: 'run',
  RUN_COMPLETE: 'runComplete',
  INIT: 'init',
  INIT_COMPLETE: 'initComplete',
  READY: 'ready'
};

// Handle bad symlink behavior, used in conjunction with TRV_FRAMEWORK_DEV
export const TEST_BASE = (process.env.TRV_FRAMEWORK_DEV && process.env.TRV_TEST_BASE)
  || FsUtil.resolveUnix(__dirname, '../..');