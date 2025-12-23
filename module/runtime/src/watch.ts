import { ManifestModuleUtil, type ChangeEventType, type ManifestModuleFileType } from '@travetto/manifest';

import { RuntimeIndex } from './manifest-index.ts';
import { ShutdownManager } from './shutdown.ts';
import { Util } from './util.ts';
import { castTo } from './types.ts';

export type WatchEvent = { file: string, action: ChangeEventType, output: string, module: string, import: string, time: number };

type WatchCompilerOptions = {
  /**
   * Restart the watch loop on compiler exit
   */
  restartOnCompilerExit?: boolean;
  /**
   * Signal to end the flow
   */
  signal?: AbortSignal;
};

const isOlderThanOneMinute = (x: number) => (Date.now() - x) > (60 * 1000);

export async function* watchCompiler(config?: WatchCompilerOptions): AsyncIterable<WatchEvent> {
  // Load at runtime
  const { CompilerClient } = await import('@travetto/compiler/support/server/client.ts');

  const client = new CompilerClient(RuntimeIndex.manifest, {
    warn(message, ...args): void { console.error('warn', message, ...args); },
    debug(message, ...args): void { console.error('debug', message, ...args); },
    error(message, ...args): void { console.error('error', message, ...args); },
    info(message, ...args): void { console.error('info', message, ...args); },
  });

  const controller = new AbortController();
  const remove = ShutdownManager.onGracefulShutdown(async () => controller.abort());

  let iterations: number[] = [];

  // Chain abort if provided
  config?.signal?.addEventListener('abort', controller.abort);

  while (
    !controller.signal.aborted &&
    iterations.length < 5 &&
    (
      config?.restartOnCompilerExit || iterations.length === 0
    )
  ) {
    await client.waitForState(['compile-end', 'watch-start'], undefined, controller.signal);

    if (!await client.isWatching()) { // If we get here, without a watch
      while (!await client.isWatching()) { // Wait until watch starts
        await Util.nonBlockingTimeout(1000 * 60);
      }
    } else {
      yield* client.fetchEvents('change', { signal: controller.signal, enforceIteration: true });
    }

    while (iterations.length && isOlderThanOneMinute(iterations[0])) {
      iterations.shift();
    }

    iterations.push(Date.now());

    await Util.nonBlockingTimeout(10 ** iterations.length);
  }

  remove();
}

export function listenForSourceChanges(onChange: () => void, debounceDelay = 10): AbortController {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let aborter: AbortController | undefined;

  const validFileTypes = new Set<ManifestModuleFileType>(['ts', 'js', 'package-json', 'typings']);

  (async function () {
    aborter = new AbortController();
    for await (const item of watchCompiler({ restartOnCompilerExit: true, signal: aborter.signal })) {
      const fileType = ManifestModuleUtil.getFileType(item.file);
      if (validFileTypes.has(fileType) && RuntimeIndex.findModuleForArbitraryFile(item.file)) {
        clearTimeout(timeout);
        timeout = setTimeout(onChange, debounceDelay);
      }
    }
  })();
  return castTo(Object.defineProperties({}, {
    abort: { get: () => aborter?.abort },
    signal: { get: () => aborter?.signal }
  }));
}