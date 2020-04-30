import { Env } from '../src/env';
import { Shutdown } from '../src/shutdown';
import { Stacktrace } from '../src/stacktrace';

// TODO: Document
export const init = {
  key: 'base',
  action: () => {
    if (Env.prod) {
      process.env.NODE_ENV = 'production';
    } else {
      Stacktrace.initHandler();
    }
    Stacktrace.clearStackFilters(); // @line-if $TRV_DEV
    Shutdown.register();
  }
};