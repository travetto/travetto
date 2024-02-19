import { RuntimeIndex } from '@travetto/manifest';

import { ExecUtil } from './exec';
import { ShutdownManager } from './shutdown';

export type WatchEvent = { file: string, action: 'create' | 'update' | 'delete' };
export type FullWatchEvent = WatchEvent & { output: string, module: string, time: number };

export async function* watchCompiler<T extends WatchEvent>(cfg?: { restartOnExit?: boolean, signal?: AbortSignal }): AsyncIterable<T> {
  // Load at runtime
  const { CompilerClient } = await import('@travetto/compiler/support/server/client.js');

  const client = new CompilerClient(RuntimeIndex.manifest, {
    error(message, ...args): void { console.error('error', message, ...args); },
    debug(message, ...args): void { console.error('debug', message, ...args); },
    info(message, ...args): void { console.error('info', message, ...args); },
  });

  const ctrl = new AbortController();
  const remove = ShutdownManager.onGracefulShutdown(async () => ctrl.abort(), watchCompiler);

  await client.waitForState(['compile-end', 'watch-start'], undefined, ctrl.signal);

  for await (const ev of client.fetchEvents('change', { signal: ctrl.signal, enforceIteration: true })) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    yield ev as unknown as T;
  }

  remove();

  if (cfg?.restartOnExit) {
    // We are done, request restart
    await ShutdownManager.gracefulShutdown(ExecUtil.RESTART_EXIT_CODE);
  }
}