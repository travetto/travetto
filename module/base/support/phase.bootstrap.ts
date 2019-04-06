import { Env } from '../src/env';
import { Shutdown } from '../src/shutdown';
import { Stacktrace } from '../src/stacktrace';

export const init = {
  key: 'base',
  action: () => {
    process.env.NODE_ENV = Env.prod ? 'production' : 'development';

    if (!Env.prod) {
      Stacktrace.initHandler();
    }

    Shutdown.register();
  }
};