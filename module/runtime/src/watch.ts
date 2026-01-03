import type { CompilerClient } from '@travetto/compiler/support/server/client.ts';
import type { CompilerChangeEvent } from '@travetto/compiler/support/types.ts';

import { RuntimeIndex } from './manifest-index.ts';
import { ShutdownManager } from './shutdown.ts';
import { Util } from './util.ts';

type RestartHandler = () => (void | Promise<void>);
type ChangeHandler<T> = (event: T) => (void | Promise<void>);
type WatchListener<T> = {
  onRestart?: RestartHandler,
  onChange?: ChangeHandler<T>,
  timeout?: number;
};

type RestartableListener<T> = {
  listen: (signal: AbortSignal) => AsyncIterable<T>;
  init?: (signal: AbortSignal) => Promise<void>;
}

let cachedClient: Promise<CompilerClient> | undefined = undefined;
function getClient(): Promise<CompilerClient> {
  return cachedClient ??= import('@travetto/compiler/support/server/client.ts').then(async module => {
    return new module.CompilerClient(RuntimeIndex.manifest, {
      warn(message, ...args): void { console.error('warn', message, ...args); },
      debug(message, ...args): void { console.error('debug', message, ...args); },
      error(message, ...args): void { console.error('error', message, ...args); },
      info(message, ...args): void { console.error('info', message, ...args); }
    });
  });
}

async function runWithRestart<T>(config: WatchListener<T> & RestartableListener<T>): Promise<void> {
  const client = await getClient();
  const maxIterations = 10;
  const timeout = config.timeout ?? 10 * 1000;
  const iterations = new Array(10).fill(Date.now());
  const controller = new AbortController();
  const { signal } = controller;
  const cleanup = ShutdownManager.onGracefulShutdown(async () => controller.abort());
  let restarted = false;

  while (!signal.aborted && (Date.now() - iterations[0]) < timeout) {

    if (restarted) {
      await Util.nonBlockingTimeout(10);
      await config.onRestart?.();
    }

    await config.init?.(signal);

    if (!await client.isWatching()) { // If we get here, without a watch
      await Util.nonBlockingTimeout(timeout / (maxIterations * 2));
    } else {
      for await (const event of config.listen(signal)) {
        await config.onChange?.(event);
      }
    }

    iterations.push(Date.now());
    iterations.shift();
    restarted = true;
  }

  cleanup?.();
}

export function compilerWatcher(listener?: WatchListener<CompilerChangeEvent>): Promise<void> {
  return runWithRestart<CompilerChangeEvent>({
    ...listener,
    async init(signal) {
      const client = await getClient();
      await client.waitForState(['compile-end', 'watch-start'], undefined, signal);
    },
    async * listen(signal) {
      const client = await getClient();
      for await (const event of client.fetchEvents('change', { signal, enforceIteration: true })) {
        if (RuntimeIndex.findModuleForArbitraryFile(event.file)) {
          yield event;
        }
      }
    }
  });
}