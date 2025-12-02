// @trv-no-transform
import fs from 'node:fs/promises';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerMode, CompilerServerInfo } from './types.ts';
import { Log } from './log.ts';
import { CompilerSetup } from './setup.ts';
import { CompilerServer } from './server/server.ts';
import { CompilerRunner } from './server/runner.ts';
import { CompilerClient } from './server/client.ts';
import { CommonUtil } from './util.ts';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const main = (ctx: ManifestContext) => {
  const client = new CompilerClient(ctx, Log.scoped('client'));
  const buildFolders = [ctx.build.outputFolder, ctx.build.compilerFolder, ctx.build.typesFolder];
  Log.root = ctx.workspace.path;
  Log.initLevel('error');

  /** Main entry point for compilation */
  const compile = async (operation: CompilerMode, setupOnly = false): Promise<void> => {
    const server = await new CompilerServer(ctx, operation).listen();
    const log = Log.scoped('main');

    // Wait for build to be ready
    if (server) {
      log.debug('Start Server');
      await server.processEvents(async function* (signal) {
        const changed = await CompilerSetup.setup(ctx);
        if (!setupOnly) {
          yield* CompilerRunner.runProcess(ctx, changed, operation, signal);
        }
      });
      log.debug('End Server');
    } else {
      log.info('Server already running, waiting for initial compile to complete');
      const ctrl = new AbortController();
      Log.consumeProgressEvents(() => client.fetchEvents('progress', { until: event => !!event.complete, signal: ctrl.signal }));
      await client.waitForState(['compile-end', 'watch-start'], 'Successfully built');
      ctrl.abort();
    }
  };

  const ops = {
    /** Stop the server */
    async stop(): Promise<void> {
      if (await client.stop()) {
        console.log(`Stopped server ${ctx.workspace.path}: ${client}`);
      } else {
        console.log(`Server not running ${ctx.workspace.path}: ${client}`);
      }
    },

    /** Restart the server */
    async restart(): Promise<void> { await client.stop().then(() => ops.watch()); },

    /** Get server info */
    info: (): Promise<CompilerServerInfo | undefined> => client.info(),

    /** Clean the server */
    async clean(): Promise<void> {
      if (await client.clean()) {
        return console.log(`Clean triggered ${ctx.workspace.path}:`, buildFolders);
      } else {
        try {
          await Promise.all(buildFolders.map(f => fs.rm(CommonUtil.resolveWorkspace(ctx, f), { force: true, recursive: true })));
        } catch { }
        return console.log(`Cleaned ${ctx.workspace.path}:`, buildFolders);
      }
    },

    /** Stream events */
    events: async (type: string, handler: (event: unknown) => unknown): Promise<void> => {
      if (type === 'change' || type === 'log' || type === 'progress' || type === 'state' || type === 'all') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        for await (const event of client.fetchEvents(type as 'change')) { await handler(event); }
      } else {
        throw new Error(`Unknown event type: ${type}`);
      }
    },

    /** Build the project */
    async build(): Promise<void> {
      Log.initLevel('info');
      await compile('build');
    },

    /** Build and watch the project */
    async watch(): Promise<void> {
      Log.initLevel('info');
      await compile('watch');
    },

    /** Set arguments and import module */
    async exec(mod: string, args?: string[]): Promise<unknown> {
      Log.initLevel('none');
      if (!(await client.isWatching())) { // Short circuit if we can
        Log.initLevel('error');
        await compile('build');
      }

      process.env.TRV_MANIFEST = CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.main.name); // Setup for running
      if (args) {
        process.argv = [process.argv0, mod, ...args];
      }
      return import(CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', mod)); // Return function to run import on a module
    },

    /** Manifest entry point */
    async manifest(output?: string, prod?: boolean): Promise<void> {
      await compile('build', true);
      await CompilerSetup.exportManifest(ctx, output, prod); return;
    }
  };
  return ops;
};

export type Operations = ReturnType<typeof main>;