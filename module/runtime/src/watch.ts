import { ManifestModuleUtil, type ChangeEventType, type ManifestModuleFileType } from '@travetto/manifest';

import { RuntimeIndex } from './manifest-index.ts';
import { ShutdownManager } from './shutdown.ts';
import { Util } from './util.ts';
import { AppError } from './error.ts';

type WatchEvent = { file: string, action: ChangeEventType, output: string, module: string, import: string, time: number };

type WatchCompilerOptions = {
  /**
   * Restart the watch loop on compiler exit
   */
  restartOnCompilerExit?: boolean;
  /**
   * Signal to end the flow
   */
  signal?: AbortSignal;
  /**
   * Run on restart
   */
  onRestart?: () => void;
};

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

  const maxIterations = 10;
  const maxWindow = 10 * 1000;
  const iterations: number[] = [];
  let iterationsExhausted = false;

  // Chain abort if provided
  config?.signal?.addEventListener('abort', controller.abort);

  while (
    !controller.signal.aborted &&
    !iterationsExhausted &&
    (config?.restartOnCompilerExit || iterations.length === 0)
  ) {
    if (iterations.length) { // Wait on next iteration
      await Util.nonBlockingTimeout(10);
    }

    await client.waitForState(['compile-end', 'watch-start'], undefined, controller.signal);

    if (!await client.isWatching()) { // If we get here, without a watch
      throw new AppError('Compiler is not running');
    } else {
      if (iterations.length) {
        config?.onRestart?.();
      }
      yield* client.fetchEvents('change', { signal: controller.signal, enforceIteration: true });
    }

    iterations.push(Date.now());
    if (iterations.length >= maxIterations) {
      iterationsExhausted = (Date.now() - iterations[0]) > maxWindow;
      iterations.shift();
    }
  }

  remove();
}

export function listenForSourceChanges(onChange: () => void, debounceDelay = 10): AbortController {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const aborter = new AbortController();

  const validFileTypes = new Set<ManifestModuleFileType>(['ts', 'js', 'package-json', 'typings']);

  function send(): void {
    clearTimeout(timeout);
    timeout = setTimeout(onChange, debounceDelay);
  }

  (async function (): Promise<void> {
    for await (const item of watchCompiler({ restartOnCompilerExit: true, signal: aborter.signal, onRestart: send })) {
      if (validFileTypes.has(ManifestModuleUtil.getFileType(item.file)) && RuntimeIndex.findModuleForArbitraryFile(item.file)) {
        send();
      }
    }
  })();

  return aborter;
}