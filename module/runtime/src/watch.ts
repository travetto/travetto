import type { CompilerClient } from '@travetto/compiler/support/server/client.ts';
import type { CompilerChangeEvent, FileChangeEvent } from '@travetto/compiler/support/types.ts';

import { RuntimeIndex } from './manifest-index.ts';
import { Util, type RunWithResultOptions } from './util.ts';
import { ShutdownManager } from './shutdown.ts';

type WatchOptions = Pick<RunWithResultOptions, 'onRestart' | 'timeout'>;

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

async function streamSource<T>(source: AsyncIterable<T>, onChange: (input: T) => unknown, signal: AbortSignal, timeout: number = 100): Promise<void> {
  const client = await getClient();
  await client.waitForState(['compile-end', 'watch-start'], undefined, signal);

  if (!await client.isWatching()) { // If we get here, without a watch
    await Util.nonBlockingTimeout(timeout);
  } else {
    for await (const event of source) {
      await onChange(event);
    }
  }
}

/**  Watch compiler for source code changes */
export async function watchCompiler(onChange: (input: CompilerChangeEvent) => unknown, options?: WatchOptions): Promise<void> {
  const client = await getClient();
  return Util.runWithRestart({
    ...options,
    onInit: stop => ShutdownManager.onGracefulShutdown(stop),
    run: ({ signal }) => streamSource(
      Util.filterAsyncIterable<CompilerChangeEvent>(
        client.fetchEvents('change', { signal, enforceIteration: true }),
        event => !!(event.import || RuntimeIndex.findModuleForArbitraryFile(event.file))
      ),
      onChange,
      signal
    )
  });
}

/** Watch for any file changes */
export async function watchFiles(onChange: (input: FileChangeEvent) => unknown, options?: WatchOptions): Promise<void> {
  const client = await getClient();
  return Util.runWithRestart({
    ...options,
    onInit: stop => ShutdownManager.onGracefulShutdown(stop),
    run: ({ signal }) => streamSource(
      client.fetchEvents('file', { signal, enforceIteration: true }),
      onChange,
      signal
    ),
  });
}