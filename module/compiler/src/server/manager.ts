import { spawn } from 'node:child_process';

import type { ManifestContext } from '@travetto/manifest';

import { CommonUtil } from '../common.ts';
import { EventUtil } from '../event.ts';
import { Log } from '../log.ts';
import { AsyncQueue } from '../queue.ts';
import type { CompilerEvent, CompilerLogLevel, CompilerServerInfo } from '../types.ts';
import type { CompilerClient } from './client.ts';
import { CompilerServer } from './server.ts';

const log = Log.scoped('compiler-exec');
const STARTUP_TIMEOUT_MILLISECONDS = 10000;
const STARTUP_POLL_INTERVAL_MILLISECONDS = 100;

/**
 * Running the compiler
 */
export class CompilerManager {
  /** Run compile process */
  static async *#runTarget(ctx: ManifestContext, watching: boolean, signal: AbortSignal): AsyncIterable<CompilerEvent> {
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
        TRV_MANIFEST: CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.workspace.name)
      },
      detached: true,
      stdio: ['pipe', 1, 2, 'ipc']
    })
      .on('message', message => EventUtil.isCompilerEvent(message) && queue.add(message))
      .on('exit', () => queue.close());

    const kill = (): unknown => {
      log.debug('Shutting down process');
      return subProcess.connected ? subProcess.send('shutdown', () => subProcess.kill()) : subProcess.kill();
    };

    process.once('SIGINT', kill);
    signal.addEventListener('abort', kill);

    yield* queue;

    if (subProcess.exitCode !== 0 && subProcess.exitCode) {
      log.error(`Terminated during compilation, code=${subProcess.exitCode}, killed=${subProcess.killed}`);
      process.exitCode = subProcess.exitCode;
    }
    process.off('SIGINT', kill);

    log.debug('Finished');
  }

  /** Spawn the compiler server as a detached background daemon */
  static async #spawnProcess(ctx: ManifestContext, client: CompilerClient): Promise<boolean> {
    log.info('Spawning compiler daemon in background');
    const subProcess = spawn(process.argv0, ['-e', 'import("@travetto/compiler/bin/trvc.js")', 'trvc', 'server'], {
      env: {
        ...process.env,
        TRV_COMPILER_WATCH: 'true'
      },
      detached: true,
      stdio: 'ignore'
    });
    subProcess.unref();

    const startTime = Date.now();
    while (Date.now() - startTime < STARTUP_TIMEOUT_MILLISECONDS) {
      await CommonUtil.blockingTimeout(STARTUP_POLL_INTERVAL_MILLISECONDS);
      const info = await client.info();
      if (info && info.state !== 'startup') {
        log.info('Compiler daemon is running', info.serverProcessId);
        return true;
      }
    }
    throw new Error(`Failed to start compiler daemon within ${STARTUP_TIMEOUT_MILLISECONDS / 1000} seconds`);
  }

  static #failWithBuildErrors(info?: CompilerServerInfo): never {
    for (const message of info?.messages?.error ?? []) {
      Log.render(message);
    }
    for (const message of info?.messages?.failure ?? []) {
      Log.render(message);
    }
    process.exitCode = 1;
    throw new Error('Compilation failed with build errors');
  }

  /** Main entry point for compilation */
  static async compile(
    ctx: ManifestContext,
    client: CompilerClient,
    config: { watch?: boolean; logLevel?: CompilerLogLevel; forceRestart?: boolean }
  ): Promise<void> {
    Log.initLevel(config.logLevel ?? 'info');
    const watch = !!config.watch;

    if (config.forceRestart && (await client.stop())) {
      log.info('Stopped existing server');
    }

    const server = await new CompilerServer(ctx, watch).listen();

    // Wait for build to be ready
    if (server) {
      log.debug('Start Server');
      await server.processEvents(signal => this.#runTarget(ctx, watch, signal));
      log.debug('End Server');
      if (server.info.state === 'compile-failed') {
        this.#failWithBuildErrors(server.info);
      }
    } else {
      log.info('Server already running, waiting for initial compile to complete');
      const controller = new AbortController();
      Log.consumeProgressEvents(() => client.fetchEvents('progress', { until: event => !!event.complete, signal: controller.signal }));
      const finalState = await client.waitForState(['compile-end', 'watch-start', 'compile-failed'], 'Successfully built');
      controller.abort();
      if (finalState === 'compile-failed') {
        this.#failWithBuildErrors(await client.info());
      }
    }
  }

  /** Start the compiler daemon if not running, and wait until ready or failed */
  static async startDaemon(
    ctx: ManifestContext,
    client: CompilerClient,
    readyMessage?: string,
    quiet = false
  ): Promise<{ state: 'already-running' | 'started' | 'compile-failed'; info?: CompilerServerInfo }> {
    const existingInfo = await client.info();
    if (existingInfo && existingInfo.state !== 'closed' && existingInfo.state !== 'startup') {
      const processId = existingInfo.serverProcessId;
      if (!quiet) {
        console.log(`Server already running ${ctx.workspace.path}: ${client.url} (PID: ${processId})`);
      }
      return { state: existingInfo.state === 'compile-failed' ? 'compile-failed' : 'already-running', info: existingInfo };
    }

    await this.#spawnProcess(ctx, client);
    const finalState = await client.waitForState(['watch-start', 'compile-failed'], readyMessage);
    const updatedInfo = await client.info();
    const processId = updatedInfo?.serverProcessId;

    if (finalState === 'compile-failed') {
      console.error(`Compiler server started with build errors (PID: ${processId})`);
      process.exitCode = 1;
    } else if (!quiet) {
      console.log(`Compiler server started ${ctx.workspace.path}: ${client.url} (PID: ${processId})`);
    }

    return {
      state: finalState === 'compile-failed' ? 'compile-failed' : 'started',
      info: updatedInfo
    };
  }

  /** Compile only if necessary */
  static async compileIfNecessary(ctx: ManifestContext, client: CompilerClient): Promise<void> {
    if (await client.isWatching()) {
      if (!(await client.waitForWatchReady())) {
        this.#failWithBuildErrors(await client.info());
      }
      return;
    }

    const canAutoCompile = (process.stdout.isTTY || process.env.TRV_AUTO_COMPILE === '1') && process.env.TRV_AUTO_COMPILE !== '0';

    if (canAutoCompile) {
      log.info('Compiler not running, auto-starting watch daemon');
      const result = await this.startDaemon(ctx, client, 'Compiler daemon ready', true);
      if (result.state === 'compile-failed') {
        this.#failWithBuildErrors(result.info);
      }
    } else {
      await this.compile(ctx, client, { watch: false, logLevel: 'error' });
    }
  }
}
