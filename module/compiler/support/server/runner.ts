import cp from 'node:child_process';
import path from 'node:path';
import { rmSync } from 'node:fs';

import type { ManifestContext, DeltaEvent } from '@travetto/manifest';

import type { CompilerOp, CompilerEvent } from '../types';
import { AsyncQueue } from '../queue';
import { LogUtil } from '../log';
import { CommonUtil } from '../util';

const log = LogUtil.logger('compiler-exec');
const isEvent = (msg: unknown): msg is CompilerEvent => !!msg && typeof msg === 'object' && 'type' in msg;

/**
 * Running the compiler
 */
export class CompilerRunner {

  /**
   * Run compile process
   */
  static async * runProcess(ctx: ManifestContext, changed: DeltaEvent[], op: CompilerOp, signal: AbortSignal): AsyncIterable<CompilerEvent> {
    const watch = op === 'watch';
    if (!changed.length && !watch) {
      yield { type: 'state', payload: { state: 'compile-end' } };
      log('debug', 'Skipped');
      return;
    } else {
      log('debug', `Started watch=${watch} changed=${changed.slice(0, 10).map(x => `${x.module}/${x.file}`)}`);
    }

    const main = path.resolve(ctx.workspace.path, ctx.build.compilerFolder, 'node_modules', '@travetto/compiler/support/entry.compiler.js');
    const deltaFile = path.resolve(ctx.workspace.path, ctx.build.compilerFolder, `manifest-delta-${Date.now()}.json`);

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(ev => ev.sourceFile);

    const queue = new AsyncQueue<CompilerEvent>();
    let kill: (() => void) | undefined;

    try {
      await CommonUtil.writeTextFile(deltaFile, changedFiles.join('\n'));

      log('info', 'Launching compiler');
      const proc = cp.spawn(process.argv0, [main, deltaFile, `${watch}`], {
        env: {
          ...process.env,
          TRV_MANIFEST: path.resolve(ctx.workspace.path, ctx.build.outputFolder, 'node_modules', ctx.workspace.name),
        },
        detached: true,
        stdio: ['pipe', 1, 2, 'ipc'],
      })
        .on('message', msg => isEvent(msg) && queue.add(msg))
        .on('exit', () => queue.close());

      kill = (): unknown => (proc.connected ? proc.send('shutdown') : proc.kill());

      process.once('SIGINT', kill);
      signal.addEventListener('abort', kill);

      yield* queue;

      if (!proc.killed && proc.exitCode !== 0) {
        log('error', `Failed during compilation, code=${proc.exitCode}, killed=${proc.killed}`);
      }

      log('debug', 'Finished');
    } finally {
      if (kill) {
        process.off('SIGINT', kill);
      }
      rmSync(deltaFile, { force: true });
    }
  }
}