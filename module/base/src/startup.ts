import { AppEnv } from './env';
import { initStackHandler } from './stacktrace';
import { Shutdown } from './shutdown';
import { bulkRequire, Handler } from './bulk-find';

export const initializers =
  bulkRequire<{ init: { action: Function, priority?: number } }>([
    Handler(x => x.relative.startsWith('node_modules/@travetto') && x.relative.endsWith('bootstrap.ts')),
    Handler(x => x.relative === 'bootstrap.ts')
  ])
    .map(x => x.init)
    .map(x => ({ priority: 100, ...x }))
    .sort((a, b) => a.priority - b.priority);

export function init() {

  process.env.NODE_ENV = AppEnv.prod ? 'production' : 'development';

  console.debug = AppEnv.debug ? console.log : () => { };

  if (!AppEnv.prod) {
    initStackHandler();
  }

  // Log unhandled rejections
  process.on('unhandledRejection', (reason, p) => {
    console.log(reason);
  });

  Shutdown.register();
}

export async function run() {
  for (const i of initializers) {
    await i.action();
  }
}