import { RuntimeIndex } from './runtime';
import { ExecUtil } from './exec';
import { ShutdownManager } from './shutdown';
import { Util } from './util';

export type WatchEvent = { file: string, action: 'create' | 'update' | 'delete', output: string, module: string, time: number };

export async function* watchCompiler(cfg?: { restartOnExit?: boolean, signal?: AbortSignal }): AsyncIterable<WatchEvent> {
  // Load at runtime
  const { CompilerClient } = await import('@travetto/compiler/support/server/client');

  const client = new CompilerClient(RuntimeIndex.manifest, {
    warn(message, ...args): void { console.error('warn', message, ...args); },
    debug(message, ...args): void { console.error('debug', message, ...args); },
    error(message, ...args): void { console.error('error', message, ...args); },
    info(message, ...args): void { console.error('info', message, ...args); },
  });

  const ctrl = new AbortController();
  const remove = ShutdownManager.onGracefulShutdown(async () => ctrl.abort(), watchCompiler);

  await client.waitForState(['compile-end', 'watch-start'], undefined, ctrl.signal);

  if (!await client.isWatching()) { // If we get here, without a watch
    while (!await client.isWatching()) { // Wait until watch starts
      await Util.nonBlockingTimeout(1000 * 60);
    }
  } else {
    yield* client.fetchEvents('change', { signal: ctrl.signal, enforceIteration: true });
  }

  remove();

  if (cfg?.restartOnExit) {
    // We are done, request restart
    await ShutdownManager.gracefulShutdown(ExecUtil.RESTART_EXIT_CODE);
  }
}