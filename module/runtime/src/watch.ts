import type { ChangeEventType } from '@travetto/manifest';

import type { CompilerClient } from '@travetto/compiler/support/server/client.ts';
import type { CompilerChangeEvent } from '@travetto/compiler/support/types.ts';

import { RuntimeIndex } from './manifest-index.ts';
import { ShutdownManager } from './shutdown.ts';
import { Util } from './util.ts';

type RestartHandler = () => (void | Promise<void>);
type ChangeHandler<T> = (event: T) => (unknown | Promise<unknown>);
type WatchSource<T> = (signal: AbortSignal) => AsyncIterable<T>;
type WatchOptions = {
  onRestart?: RestartHandler;
  timeout?: number;
};

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

async function runWithRestart<T>(source: WatchSource<T>, onChange: ChangeHandler<T>, config?: WatchOptions): Promise<void> {
  const client = await getClient();
  const maxIterations = 10;
  const timeout = config?.timeout ?? 10 * 1000;
  const iterations = new Array(10).fill(Date.now());
  const controller = new AbortController();
  const { signal } = controller;
  const cleanup = ShutdownManager.onGracefulShutdown(async () => controller.abort());
  let restarted = false;

  while (!signal.aborted && (Date.now() - iterations[0]) < timeout) {

    if (restarted) {
      await Util.nonBlockingTimeout(10);
      await config?.onRestart?.();
    }

    await client.waitForState(['compile-end', 'watch-start'], undefined, signal);

    if (!await client.isWatching()) { // If we get here, without a watch
      await Util.nonBlockingTimeout(timeout / (maxIterations * 2));
    } else {
      for await (const event of source(signal)) {
        await onChange(event);
      }
    }

    iterations.push(Date.now());
    iterations.shift();
    restarted = true;
  }

  cleanup?.();
}

export function watchCompiler(onChange: ChangeHandler<CompilerChangeEvent>, options?: WatchOptions): Promise<void> {
  return runWithRestart(
    async function* listen(signal) {
      const client = await getClient();
      for await (const event of client.fetchEvents('change', { signal, enforceIteration: true })) {
        if (event.import || RuntimeIndex.findModuleForArbitraryFile(event.file)) {
          yield event;
        }
      }
    },
    onChange,
    options
  );
}

export function watchFiles(onChange: ChangeHandler<{ file: string, action: ChangeEventType }>, options?: WatchOptions): Promise<void> {
  return runWithRestart(
    async function* listen(signal) {
      const client = await getClient();
      for await (const event of client.fetchEvents('file', { signal, enforceIteration: true })) {
        yield* event.files;
      }
    },
    onChange,
    options
  );
}