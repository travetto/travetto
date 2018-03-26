import { AppEnv } from './env';
import { initStackHandler } from './stacktrace';
import { Shutdown } from './shutdown';
import { bulkRequire } from './bulk-find';

export const initializers =
  bulkRequire<{ init: { action: Function, priority?: number } }>(
    ['node_modules/@travetto/*/bootstrap.ts', 'bootstrap.ts']
  )
    .map(x => x.init)
    .map(x => ({ priority: 100, ...x }))
    .sort((a, b) => a.priority - b.priority);

export async function init() {

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

  if (!process.env.DELAYED_INIT) {
    return await bootstrap();
  }
}

export async function bootstrap() {
  for (const i of initializers) {
    await i.action();
  }
}