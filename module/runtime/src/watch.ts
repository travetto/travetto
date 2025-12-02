import { RuntimeIndex } from './manifest-index.ts';
import { ExecUtil } from './exec.ts';
import { ShutdownManager } from './shutdown.ts';
import { Util } from './util.ts';

export type WatchEvent = { file: string, action: 'create' | 'update' | 'delete', output: string, module: string, time: number };

export async function* watchCompiler(config?: { restartOnExit?: boolean, signal?: AbortSignal }): AsyncIterable<WatchEvent> {
  // Load at runtime
  const { CompilerClient } = await import('@travetto/compiler/support/server/client.ts');

  const client = new CompilerClient(RuntimeIndex.manifest, {
    warn(message, ...args): void { console.error('warn', message, ...args); },
    debug(message, ...args): void { console.error('debug', message, ...args); },
    error(message, ...args): void { console.error('error', message, ...args); },
    info(message, ...args): void { console.error('info', message, ...args); },
  });

  const ctrl = new AbortController();
  const remove = ShutdownManager.onGracefulShutdown(async () => ctrl.abort());

  await client.waitForState(['compile-end', 'watch-start'], undefined, ctrl.signal);

  if (!await client.isWatching()) { // If we get here, without a watch
    while (!await client.isWatching()) { // Wait until watch starts
      await Util.nonBlockingTimeout(1000 * 60);
    }
  } else {
    yield* client.fetchEvents('change', { signal: ctrl.signal, enforceIteration: true });
  }

  remove();

  if (config?.restartOnExit) {
    // We are done, request restart
    await ShutdownManager.gracefulShutdown('@travetto/runtime:watchCompiler');
    process.exit(ExecUtil.RESTART_EXIT_CODE);
  }
}