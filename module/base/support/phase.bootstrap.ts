import { Env } from '../src/env';
import { Shutdown } from '../src/shutdown';
import { Stacktrace } from '../src/stacktrace';

export const init = {
  key: 'base',
  action: () => {
    process.env.NODE_ENV = Env.prod ? 'production' : 'development';

    console.debug = Env.debug ? console.log : () => { };

    if (!Env.prod) {
      Stacktrace.initHandler();
    }

    // Log unhandled rejections
    process.on('unhandledRejection', (reason, p) => Env.error(reason));

    Shutdown.register();
  }
};