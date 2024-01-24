import fs from 'node:fs/promises';
import timers from 'node:timers/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerOp, CompilerServerInfo } from './types';
import { LogUtil } from './log';
import { CommonUtil } from './util';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import { CompilerClient } from './server/client';

const SHUTDOWN_TIMEOUT = 3000;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const main = (ctx: ManifestContext) => {
  const log = LogUtil.logger('client.main');
  const client = new CompilerClient(ctx, log);
  const buildFolders = [ctx.build.outputFolder, ctx.build.compilerFolder];

  const ops = {
    /** Stop the server */
    async stop(quiet = false): Promise<void> {
      const info = await client.info();
      if (info) {
        await client.stop();
        const start = Date.now();
        for (; ;) { // Ensure its done
          try {
            process.kill(info.compilerPid, 0);
            await timers.setTimeout(100);
            if ((Date.now() - start) > SHUTDOWN_TIMEOUT) { // If we exceed the max timeout
              process.kill(info.compilerPid); // Force kill
            }
          } catch {
            break;
          }
        }
        if (!quiet) {
          console.log(`Stopped server ${ctx.workspace.path}: ${client}`);
        }
      } else {
        if (quiet) {
          console.log(`Server not running ${ctx.workspace.path}: ${client}`);
        }
      }
    },

    /** Get server info */
    info: (): Promise<CompilerServerInfo | undefined> => client.info(),

    /** Clean the server */
    async clean(): Promise<void> {
      if (await client.clean()) {
        return console.log(`Clean triggered ${ctx.workspace.path}:`, buildFolders);
      } else {
        await Promise.all(buildFolders.map(f => fs.rm(path.resolve(ctx.workspace.path, f), { force: true, recursive: true })));
        return console.log(`Cleaned ${ctx.workspace.path}:`, buildFolders);
      }
    },

    /** Stream events */
    events: async (type: string, handler: (ev: unknown) => unknown): Promise<void> => {
      LogUtil.initLogs(ctx, 'error');
      if (type === 'change' || type === 'log' || type === 'progress' || type === 'state') {
        for await (const ev of client.fetchEvents(type)) { await handler(ev); }
      } else {
        throw new Error(`Unknown event type: ${type}`);
      }
    },

    /** Main entry point for compilation */
    async compile(op: CompilerOp, setupOnly = false): Promise<(mod: string) => Promise<unknown>> {
      // Short circuit if we can
      if (op === 'run' && await client.isWatching()) {
        return CommonUtil.moduleLoader(ctx);
      }

      LogUtil.initLogs(ctx, op === 'run' ? 'error' : 'info');

      const server = await new CompilerServer(ctx, op).listen();

      // Wait for build to be ready
      if (server) {
        log('debug', 'Start Server');
        await server.processEvents(async function* (signal) {
          const changed = await CompilerSetup.setup(ctx);
          if (!setupOnly) {
            yield* CompilerRunner.runProcess(ctx, changed, op, signal);
          }
        });
        log('debug', 'End Server');
      } else {
        log('info', 'Server already running, waiting for initial compile to complete');
        const ctrl = new AbortController();
        LogUtil.consumeProgressEvents(() => client.fetchEvents('progress', { until: ev => !!ev.complete, signal: ctrl.signal }));
        await client.waitForState(['compile-end', 'watch-start'], 'Successfully built');
        ctrl.abort();
      }
      return CommonUtil.moduleLoader(ctx);
    },

    /** Manifest entry point */
    async manifest(output?: string, prod?: boolean): Promise<void> {
      await ops.compile('run', true);
      await CompilerSetup.exportManifest(ctx, output, prod); return;
    }
  };
  return ops;
};