import type { ChangeEventType } from '@travetto/manifest';

import { RuntimeIndex } from './manifest-index.ts';
import { ExecUtil } from './exec.ts';
import { ShutdownManager } from './shutdown.ts';
import { Util } from './util.ts';

export type WatchEvent = { file: string, action: ChangeEventType, output: string, module: string, import: string, time: number };

type WatchCompilerOptions = {
  /**
   * Restart the watch loop on compiler exit
   */
  restartOnExit?: boolean;
  /**
   * Signal to cancel the watch
   */
  signal?: AbortSignal;
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

  await client.waitForState(['compile-end', 'watch-start'], undefined, controller.signal);

  if (!await client.isWatching()) { // If we get here, without a watch
    while (!await client.isWatching()) { // Wait until watch starts
      await Util.nonBlockingTimeout(1000 * 60);
    }
  } else {
    yield* client.fetchEvents('change', { signal: controller.signal, enforceIteration: true });
  }

  remove();

  if (config?.restartOnExit) {
    // We are done, request restart
    await ShutdownManager.gracefulShutdown('@travetto/runtime:watchCompiler');
    process.exit(ExecUtil.RESTART_EXIT_CODE);
  }
}