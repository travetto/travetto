import { RootIndex } from '@travetto/manifest';

import { ConsoleManager } from '../src/console';
import { ShutdownManager } from '../src/shutdown';

// Setup everything
let initialized = false;
export async function init(): Promise<void> {
  if (initialized) {
    return;
  }

  initialized = true;

  // @ts-expect-error -- Lock to prevent __proto__ pollution in JSON
  const objectProto = Object.prototype.__proto__;
  Object.defineProperty(Object.prototype, '__proto__', {
    get() { return objectProto; },
    set(val) { Object.setPrototypeOf(this, val); }
  });

  // Setup stack traces
  Error.stackTraceLimit = 50; // Deep limit
  try { (await import('source-map-support')).install(); } catch { } // Register source maps

  // Initialize
  await ConsoleManager.register();

  // Register shutdown handler
  ShutdownManager.register();

  if (RootIndex.hasModule('@travetto/terminal')) {
    const { GlobalTerminal } = await import('@travetto/terminal');
    await GlobalTerminal.init();
    ShutdownManager.onShutdown('', () => GlobalTerminal.reset());
  }
}