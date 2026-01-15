import { spawn } from 'node:child_process';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerEvent, CompilerLogLevel } from '../types.ts';
import { AsyncQueue } from '../queue.ts';
import { Log } from '../log.ts';
import { CommonUtil } from '../common.ts';
import { EventUtil } from '../event.ts';
import type { CompilerClient } from './client.ts';
import { CompilerServer } from './server.ts';

const log = Log.scoped('compiler-exec');

/**
 * Running the compiler
 */
export class CompilerManager {
  /** Run compile process */
  static async * #runTarget(ctx: ManifestContext, watching: boolean, signal: AbortSignal): AsyncIterable<CompilerEvent> {
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
        TRV_MANIFEST: CommonUtil.resolveCompiledOutput(ctx, ctx.workspace.name),
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

  /** Main entry point for compilation */
  static async compile(ctx: ManifestContext, client: CompilerClient, config: { watch?: boolean, logLevel?: CompilerLogLevel, forceRestart?: boolean }): Promise<void> {
    Log.initLevel(config.logLevel ?? 'info');
    const watch = !!config.watch;

    if (config.forceRestart && await client.stop()) {
      log.info('Stopped existing server');
    }

    const server = await new CompilerServer(ctx, watch).listen();

    // Wait for build to be ready
    if (server) {
      log.debug('Start Server');
      await server.processEvents(signal => this.#runTarget(ctx, watch, signal));
      log.debug('End Server');
    } else {
      log.info('Server already running, waiting for initial compile to complete');
      const controller = new AbortController();
      Log.consumeProgressEvents(() => client.fetchEvents('progress', { until: event => !!event.complete, signal: controller.signal }));
      await client.waitForState(['compile-end', 'watch-start'], 'Successfully built');
      controller.abort();
    }
  }

  /** Compile only if necessary */
  static async compileIfNecessary(ctx: ManifestContext, client: CompilerClient): Promise<void> {
    if (!(await client.isWatching())) { // Short circuit if we can
      await this.compile(ctx, client, { watch: false, logLevel: 'error' });
    }
  }
}