// @trv-no-transform
import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerMode, CompilerServerInfo } from './types';
import { Log } from './log';
import { CommonUtil } from './util';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import { CompilerClient } from './server/client';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const main = (ctx: ManifestContext) => {
  const client = new CompilerClient(ctx, Log.scoped('client'));
  const buildFolders = [ctx.build.outputFolder, ctx.build.compilerFolder];
  Log.root = ctx.workspace.path;
  Log.initLevel('error');

  /** Main entry point for compilation */
  const compile = async (op: CompilerMode, setupOnly = false): Promise<void> => {
    const server = await new CompilerServer(ctx, op).listen();
    const log = Log.scoped('main');

    // Wait for build to be ready
    if (server) {
      log.debug('Start Server');
      await server.processEvents(async function* (signal) {
        const changed = await CompilerSetup.setup(ctx);
        if (!setupOnly) {
          yield* CompilerRunner.runProcess(ctx, changed, op, signal);
        }
      });
      log.debug('End Server');
    } else {
      log.info('Server already running, waiting for initial compile to complete');
      const ctrl = new AbortController();
      Log.consumeProgressEvents(() => client.fetchEvents('progress', { until: ev => !!ev.complete, signal: ctrl.signal }));
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
        await Promise.all(buildFolders.map(f => fs.rm(path.resolve(ctx.workspace.path, f), { force: true, recursive: true })));
        return console.log(`Cleaned ${ctx.workspace.path}:`, buildFolders);
      }
    },

    /** Stream events */
    events: async (type: string, handler: (ev: unknown) => unknown): Promise<void> => {
      if (type === 'change' || type === 'log' || type === 'progress' || type === 'state') {
        for await (const ev of client.fetchEvents(type)) { await handler(ev); }
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

    /** Build and return a loader */
    async getLoader(): Promise<(mod: string, args?: string[]) => Promise<unknown>> {
      Log.initLevel('none');
      if (!(await client.isWatching())) { // Short circuit if we can
        Log.initLevel('error');
        await compile('build');
      }
      return CommonUtil.moduleLoader(ctx);
    },

    /** Manifest entry point */
    async manifest(output?: string, prod?: boolean): Promise<void> {
      await compile('build', true);
      await CompilerSetup.exportManifest(ctx, output, prod); return;
    }
  };
  return ops;
};