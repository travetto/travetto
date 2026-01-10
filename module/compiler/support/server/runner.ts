import { spawn } from 'node:child_process';

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

    if (!changed.length && mode !== 'watch') {
      yield { type: 'state', payload: { state: 'compile-end' } };
      log.debug('Skipped');
      return;
    } else {
      const changedList = changed.slice(0, 10).map(event => `${event.module}/${event.file}`);
      log.debug(`Started mode=${mode} changed=${changedList}`);
    }

    const queue = new AsyncQueue<CompilerEvent>();

    log.info('Launching compiler');
    const subProcess = spawn(process.argv0, ['-e', 'import("@travetto/compiler/bin/trvc-target.js")'], {
      env: {
        ...process.env,
        TRV_COMPILER_MODE: mode,
        TRV_MANIFEST: CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.workspace.name),
      },

      detached: true,
      stdio: ['pipe', 'pipe', 2, 'ipc'],
    })
      .on('message', message => isEvent(message) && queue.add(message))
      .on('exit', () => queue.close());

    subProcess.stdin!.write(changed.map(event => event.sourceFile).join('\n'));
    subProcess.stdin!.end();

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
  }
}