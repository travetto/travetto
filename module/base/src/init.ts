import { AppEnv } from './env';
import { initStackHandler } from './stacktrace';

export function init() {

  process.env.NODE_ENV = AppEnv.prod ? 'production' : 'development';

  if (AppEnv.debug) {
    console.debug = console.log;
  }

  if (!AppEnv.prod) {
    initStackHandler();
  }

  // Log unhandled rejections
  process.on('unhandledRejection', (reason, p) => {
    console.log(reason);
  });
}