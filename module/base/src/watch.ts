import { RuntimeContext } from '@travetto/manifest';

import { ExecUtil } from './exec';
import { ShutdownManager } from './shutdown';

export type WatchEvent = { file: string, action: 'create' | 'update' | 'delete', folder: string };
export type FullWatchEvent = WatchEvent & { output: string, module: string, time: number };

export async function watchCompiler<T extends WatchEvent>(handler: (ev: T) => unknown, cfg?: { restartOnExit?: boolean, signal?: AbortSignal }): Promise<void> {
  // Load at runtime
  const { CompilerClient } = await import('@travetto/compiler/support/server/client.js');

  const client = new CompilerClient(RuntimeContext, (level, message, ...args) =>
    // eslint-disable-next-line no-console
    console[level](message, ...args)
  );

  const ctrl = new AbortController();
  const remove = ShutdownManager.onGracefulShutdown(async () => ctrl.abort(), watchCompiler);

  await client.waitForState(['compile-end', 'watch-start'], undefined, ctrl.signal);

  for await (const ev of client.fetchEvents('change', { signal: ctrl.signal, enforceIteration: true })) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await handler(ev as unknown as T);
  }

  remove();

  if (cfg?.restartOnExit) {
    // We are done, request restart
    await ShutdownManager.gracefulShutdown(ExecUtil.RESTART_EXIT_CODE);
  }
}