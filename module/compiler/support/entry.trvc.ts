import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import type { CompilerOp, CompilerServerInfo } from './types';
import { CompilerClient } from './server/client';
import { CommonUtil } from './util';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const main = (ctx: ManifestContext) => {
  const client = new CompilerClient(ctx);
  const buildFolders = [ctx.build.outputFolder, ctx.build.compilerFolder];

  const ops = {
    /** Stop the server */
    async stop(): Promise<void> {
      if (await client.stop()) {
        console.log(`Stopped server ${ctx.workspace.path}: [${client.url}]`);
      } else {
        console.log(`Server not running ${ctx.workspace.path}: [${client.url}]`);
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
        await client.waitForBuild();
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