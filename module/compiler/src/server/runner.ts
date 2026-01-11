import { spawn } from 'node:child_process';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerEvent } from '../types.ts';
import { AsyncQueue } from '../queue.ts';
import { Log } from '../log.ts';
import { CommonUtil } from '../common.ts';
import { EventUtil } from '../event.ts';

const log = Log.scoped('compiler-exec');

/**
 * Running the compiler
 */
export class CompilerRunner {

  /**
   * Run compile process
   */
  static async * runProcess(ctx: ManifestContext, watching: boolean, signal: AbortSignal): AsyncIterable<CompilerEvent> {
    if (signal.aborted) {
      log.debug('Skipping, shutting down');
      return;
    }

    const queue = new AsyncQueue<CompilerEvent>();

    log.info('Launching compiler');
    const subProcess = spawn(process.argv0, ['-e', 'import("@travetto/compiler/bin/trvc-target.js")'], {
      env: {
        ...process.env,
        TRV_COMPILER_WATCH: String(watching),
        TRV_MANIFEST: CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.workspace.name),
      },
      detached: true,
      stdio: ['pipe', 1, 2, 'ipc'],
    })
      .on('message', message => EventUtil.isCompilerEvent(message) && queue.add(message))
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
  }
}