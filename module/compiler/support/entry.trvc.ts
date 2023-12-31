import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerEventType, CompilerOp, CompilerServerInfo } from './types';
import { LogUtil } from './log';
import { CommonUtil } from './util';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import { CompilerClient } from './server/client';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const main = (ctx: ManifestContext) => {
  const client = new CompilerClient(ctx, LogUtil.scoped('client.main'));
  const buildFolders = [ctx.build.outputFolder, ctx.build.compilerFolder];

  const ops = {
    /** Stop the server */
    async stop(): Promise<void> {
      if (await client.stop()) {
        console.log(`Stopped server ${ctx.workspace.path}: ${client}`);
      } else {
        console.log(`Server not running ${ctx.workspace.path}: ${client}`);
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
    events: async (type: CompilerEventType, handler: (ev: unknown) => unknown): Promise<void> => {
      LogUtil.initLogs(ctx, 'error');
      for await (const ev of client.fetchEvents(type)) { await handler(ev); }
    },

    /** Main entry point for compilation */
    async compile(op: CompilerOp, setupOnly = false): Promise<(mod: string) => Promise<unknown>> {
      LogUtil.initLogs(ctx, op === 'run' ? 'error' : 'info');

      const server = await new CompilerServer(ctx, op).listen();

      // Wait for build to be ready
      if (server) {
        await server.processEvents(async function* (signal) {
          const changed = await CompilerSetup.setup(ctx);
          if (!setupOnly) {
            yield* CompilerRunner.runProcess(ctx, changed, op, signal);
          }
        });
      } else {
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