import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import type { CompilerOp, CompilerServerInfo } from './types';
import { CompilerClientUtil } from './server/client';
import { CommonUtil } from './util';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const main = (ctx: ManifestContext) => {
  const ops = {
    /** Stop the server */
    async stop(): Promise<void> {
      if (await fetch(`${ctx.compilerUrl}/stop`).then(v => v.ok, () => false)) {
        console.log(`Stopped server ${ctx.workspacePath}: [${ctx.compilerUrl}]`);
      } else {
        console.log(`Server not running ${ctx.workspacePath}: [${ctx.compilerUrl}]`);
      }
    },

    /** Get server info */
    info(): Promise<CompilerServerInfo> {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return fetch(ctx.compilerUrl).then(v => v.json(), () => ({ state: 'Server not running' })) as Promise<CompilerServerInfo>;
    },

    /** Clean the server */
    async clean(): Promise<void> {
      const folders = [ctx.outputFolder, ctx.compilerFolder];
      if (await fetch(`${ctx.compilerUrl}/clean`).then(v => v.ok, () => false)) {
        return console.log(`Clean triggered ${ctx.workspacePath}:`, folders);
      } else {
        await Promise.all(folders.map(f => fs.rm(path.resolve(ctx.workspacePath, f), { force: true, recursive: true })));
        return console.log(`Cleaned ${ctx.workspacePath}:`, folders);
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
        await CompilerClientUtil.waitForBuild(ctx);
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