import { AppEnv } from '../src/env';
import { Shutdown } from '../src/shutdown';
import { initStackHandler } from '../src/stacktrace';

export const init = {
  priority: -100000,
  action: () => {
    process.env.NODE_ENV = AppEnv.prod ? 'production' : 'development';

    console.debug = AppEnv.debug ? console.log : () => { };

    if (!AppEnv.prod) {
      initStackHandler();
    }

    // Log unhandled rejections
    process.on('unhandledRejection', (reason, p) => {
      try {
        // Attempt to use logger if exists, this helps with not blowing the stack up
        require('@travetto/log').Logger.log('error', reason);
      } catch (e) {
        console.log(reason);
      }
    });

    Shutdown.register();
  }
};