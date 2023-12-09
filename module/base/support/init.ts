import { existsSync, readFileSync } from 'fs';
import { install } from 'source-map-support';

import { Env } from '../src/env';
import { ConsoleManager } from '../src/console';
import { ShutdownManager } from '../src/shutdown';

// Setup everything
export async function init(): Promise<void> {
  // Handle stack traces
  Error.stackTraceLimit = 50; // Deep limit
  install({
    retrieveFile: file => {
      file = file.replace(/^\s*file:\/\/?(\/|[a-z]:)/, (_, d) => d);
      return existsSync(file) ? readFileSync(file, 'utf8') : null;
    }
  });
  // Init console
  await ConsoleManager.register({ debug: Env.debug });
}

export async function cleanup(): Promise<void> {
  await ShutdownManager.gracefulShutdown(process.exitCode);
}