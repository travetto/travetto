import cp from 'node:child_process';
import { rmSync } from 'node:fs';

import type { ManifestContext, DeltaEvent } from '@travetto/manifest';

import type { CompilerEvent, CompilerMode } from '../types.ts';
import { AsyncQueue } from '../queue.ts';
import { Log } from '../log.ts';
import { CommonUtil } from '../util.ts';

const log = Log.scoped('compiler-exec');
const isEvent = (value: unknown): value is CompilerEvent => !!value && typeof value === 'object' && 'type' in value;

/**
 * Running the compiler
 */
export class CompilerRunner {

  /**
   * Run compile process
   */
  static async * runProcess(ctx: ManifestContext, changed: DeltaEvent[], mode: CompilerMode, signal: AbortSignal): AsyncIterable<CompilerEvent> {
    if (signal.aborted) {
      log.debug('Skipping, shutting down');
      return;
    }

    const watch = mode === 'watch';
    if (!changed.length && !watch) {
      yield { type: 'state', payload: { state: 'compile-end' } };
      log.debug('Skipped');
      return;
    } else {
      const changedList = changed.slice(0, 10).map(event => `${event.module}/${event.file}`);
      log.debug(`Started watch=${watch} changed=${changedList.join(', ')}`);
    }

    const main = CommonUtil.resolveWorkspace(ctx, ctx.build.compilerFolder, 'node_modules', '@travetto/compiler/support/entry.compiler.js');
    const deltaFile = CommonUtil.resolveWorkspace(ctx, ctx.build.compilerFolder, `manifest-delta-${Date.now()}.json`);

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(event => event.sourceFile);

    const queue = new AsyncQueue<CompilerEvent>();

    try {
      await CommonUtil.writeTextFile(deltaFile, changedFiles.join('\n'));

      log.info('Launching compiler');
      const subProcess = cp.spawn(process.argv0, [main, deltaFile, `${watch}`], {
        env: {
          ...process.env,
          TRV_MANIFEST: CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.workspace.name),
        },
        detached: true,
        stdio: ['pipe', 1, 2, 'ipc'],
      })
        .on('message', input => isEvent(input) && queue.add(input))
        .on('exit', () => queue.close());

      const kill = (): unknown => {
        log.debug('Shutting down process');
        return (subProcess.connected ? subProcess.send('shutdown', () => subProcess.kill()) : subProcess.kill());
      };

      process.once('SIGINT', kill);
      signal.addEventListener('abort', kill);

      yield* queue;

      if (subProcess.exitCode !== 0) {
        log.error(`Terminated during compilation, code=${subProcess.exitCode}, killed=${subProcess.killed}`);
      }
      process.off('SIGINT', kill);

      log.debug('Finished');
    } finally {
      rmSync(deltaFile, { force: true });
    }
  }
}