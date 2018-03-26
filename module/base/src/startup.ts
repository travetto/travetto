import { AppEnv } from './env';
import { initStackHandler } from './stacktrace';
import { Shutdown } from './shutdown';
import { bulkRequire } from './bulk-find';

const initializers =
  bulkRequire<{ init: Function, priority?: number }>(
    '*/src/startup.ts',
    `${process.cwd()}/node_modules/@travetto`,
    x => x.includes('/base/')
  )
    .map(x => ({ priority: 100, ...x }))
    .sort((a, b) => a.priority - b.priority);

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

  Shutdown.register();

  for (const startup of initializers) {
    startup.init();
  }
}