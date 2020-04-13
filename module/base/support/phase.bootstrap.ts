import { Env } from '../src/env';
import { Shutdown } from '../src/shutdown';
import { Stacktrace } from '../src/stacktrace';

export const init = {
  key: 'base',
  action: () => {
    if (Env.prod) {
      process.env.NODE_ENV = 'production';
    } else {
      Stacktrace.initHandler();
    }
    if (TRV_FRAMEWORK_DEV) {
      Stacktrace.clearStackFilters();
    }
    Shutdown.register();
  }
};