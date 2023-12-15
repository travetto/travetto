import cp from 'node:child_process';
import path from 'node:path';

import type { ManifestContext, ManifestRoot, DeltaEvent } from '@travetto/manifest';

import type { CompilerOp, CompilerServerEvent } from '../types';
import { AsyncQueue } from '../queue';
import { LogUtil } from '../log';
import { CommonUtil } from '../util';

const log = LogUtil.log.bind(null, 'compiler-exec');

/**
 * Running the compiler
 */
export class CompilerRunner {

  /**
   * Run compile process
   */
  static async * runProcess(ctx: ManifestContext, manifest: ManifestRoot, changed: DeltaEvent[], op: CompilerOp, signal: AbortSignal): AsyncIterable<CompilerServerEvent> {
    const watch = op === 'watch';
    if (!changed.length && !watch) {
      yield { type: 'state', payload: { state: 'compile-end' } };
      log('debug', 'Skipped');
      return;
    } else {
      log('debug', `Started watch=${watch} changed=${changed.slice(0, 10).map(x => `${x.module}/${x.file}`)}`);
    }

    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/entry.compiler.js');
    const deltaFile = path.resolve(ctx.workspacePath, ctx.toolFolder, 'manifest-delta.json');

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(ev =>
      path.resolve(manifest.workspacePath, manifest.modules[ev.module].sourceFolder, ev.file)
    );

    let proc: cp.ChildProcess | undefined;
    let cleanup: (() => void) | undefined;

    const queue = new AsyncQueue<CompilerServerEvent>(signal);

    try {
      await CommonUtil.writeTextFile(deltaFile, changedFiles.join('\n'));

      log('info', 'Launching compiler');
      proc = cp.spawn(process.argv0, [main, deltaFile, `${watch}`], {
        env: {
          ...process.env,
          TRV_MANIFEST: path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules', ctx.mainModule),
        },
        stdio: ['pipe', 'pipe', 2, 'ipc'],
      })
        .on('message', msg => {
          if (msg && typeof msg === 'object' && 'type' in msg) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            queue.add(msg as CompilerServerEvent);
          }
        })
        .on('exit', code => {
          if (code !== null && code > 0) {
            log('error', 'Failed during compilation');
          }
          queue.close();
        });

      cleanup = (): void => {
        if (proc && proc.killed === false) {
          proc.kill('SIGKILL');
        }
        process.off('exit', cleanup!);
      };
      signal.addEventListener('abort', cleanup);
      process.on('exit', cleanup);

      yield* queue;

      log('debug', `exit code: ${proc?.exitCode}`);
      log('debug', 'Finished');
    } finally {
      cleanup?.();
    }
  }
}