import cp from 'node:child_process';
import path from 'node:path';

import type { ManifestContext, ManifestRoot, DeltaEvent } from '@travetto/manifest';

import type { CompilerOp, CompilerProgressEvent, CompilerServerEvent } from '../types';
import { AsyncQueue } from '../queue';
import { LogUtil } from '../log';
import { CommonUtil } from '../util';
import { CompilerClientUtil } from './client';

const log = LogUtil.log.bind(null, 'compiler-exec');

/**
 * Running the compiler
 */
export class CompilerRunner {

  /**
   * Track compiler progress
   */
  static async trackProgress(ctx: ManifestContext, src: AsyncIterable<CompilerProgressEvent>): Promise<void> {
    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/terminal/__index__.js');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { GlobalTerminal } = await import(main) as typeof import('@travetto/terminal');

    await GlobalTerminal.init();
    await GlobalTerminal.trackProgress(src,
      x => ({ ...x, text: `Compiling [%idx/%total] -- ${x.message}` }),
      { position: 'bottom', minDelay: 50, staticMessage: 'Compiling' }
    );
  }

  /**
   * Run compile process
   */
  static async* runProcess(ctx: ManifestContext, manifest: ManifestRoot, changed: DeltaEvent[], op: CompilerOp, signal: AbortSignal): AsyncIterable<CompilerServerEvent> {
    const watch = op === 'watch';
    if (!changed.length && !watch) {
      yield { type: 'state', payload: { state: 'compile-end' } };
      log('debug', 'Skipped');
      return;
    } else {
      log('debug', `Started watch=${watch} changed=${changed.slice(0, 10).map(x => `${x.module}/${x.file}`)}`);
    }

    // Track progress if not in run mode
    if (op !== 'run') {
      this.trackProgress(ctx, CompilerClientUtil.fetchEvents(ctx, 'progress', signal, ev => !!ev.complete));
    }

    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/entry.compiler.js');
    const deltaFile = path.resolve(ctx.workspacePath, ctx.toolFolder, 'manifest-delta.json');

    const changedFiles = changed[0]?.file === '*' ? ['*'] : changed.map(ev =>
      path.resolve(manifest.workspacePath, manifest.modules[ev.module].sourceFolder, ev.file)
    );

    let proc: cp.ChildProcess | undefined;
    let kill: (() => void) | undefined;

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

      kill = (): void => { proc?.kill('SIGKILL'); };
      signal.addEventListener('abort', kill);
      process.on('exit', kill);

      yield* queue;

      log('debug', `exit code: ${proc?.exitCode}`);
      log('debug', 'Finished');
    } finally {
      if (proc?.killed === false) {
        proc.kill('SIGKILL');
      }
      if (kill) {
        process.off('exit', kill);
      }
    }
  }
}