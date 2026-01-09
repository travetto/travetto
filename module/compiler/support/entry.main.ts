// @trv-no-transform
import fs from 'node:fs/promises';

import { getManifestContext, type ManifestContext } from '@travetto/manifest';

import { isComplilerEventType, type CompilerMode, type CompilerServerInfo } from './types.ts';
import { Log } from './log.ts';
import { CompilerSetup } from './setup.ts';
import { CompilerServer } from './server/server.ts';
import { CompilerRunner } from './server/runner.ts';
import { CompilerClient } from './server/client.ts';
import { CommonUtil } from './util.ts';

class Operations {

  client: CompilerClient;
  buildFolders: string[];
  ctx: ManifestContext;

  constructor(ctx?: ManifestContext) {
    this.setContext(ctx);
  }

  setContext(ctx?: ManifestContext): void {
    this.ctx = ctx ?? getManifestContext();
    this.client = new CompilerClient(this.ctx, Log.scoped('client'));
    this.buildFolders = [this.ctx.build.outputFolder, this.ctx.build.typesFolder];
    Log.root = this.ctx.workspace.path;
    Log.initLevel('error');
  }


  /** Main entry point for compilation */
  async compile(operation: CompilerMode, setupOnly = false): Promise<void> {
    const server = await new CompilerServer(this.ctx, operation).listen();
    const log = Log.scoped('main');

    // Wait for build to be ready
    if (server) {
      log.debug('Start Server');
      const ctx = this.ctx;
      await server.processEvents(async function* (signal) {
        const changed = await CompilerSetup.setup(ctx);
        if (!setupOnly) {
          yield* CompilerRunner.runProcess(ctx, changed, operation, signal);
        }
      });
      log.debug('End Server');
    } else {
      log.info('Server already running, waiting for initial compile to complete');
      const controller = new AbortController();
      Log.consumeProgressEvents(() => this.client.fetchEvents('progress', { until: event => !!event.complete, signal: controller.signal }));
      await this.client.waitForState(['compile-end', 'watch-start'], 'Successfully built');
      controller.abort();
    }
  }

  /** Stop the server */
  async stop(): Promise<void> {
    if (await this.client.stop()) {
      console.log(`Stopped server ${this.ctx.workspace.path}: ${this.client}`);
    } else {
      console.log(`Server not running ${this.ctx.workspace.path}: ${this.client}`);
    }
  }

  /** Restart the server */
  async restart(): Promise<void> {
    await this.client.stop();
    await this.watch();
  }

  /** Get server info */
  info(): Promise<CompilerServerInfo | undefined> {
    return this.client.info();
  }

  async infoStdout(): Promise<void> {
    const info = await this.info();
    process.stdout.write(`${JSON.stringify(info, undefined, 2)}\n`) ||
      await new Promise(resolve => process.stdout.once('drain', resolve));
  }

  /** Clean the server */
  async clean(): Promise<void> {
    if (await this.client.clean()) {
      return console.log(`Clean triggered ${this.ctx.workspace.path}:`, this.buildFolders);
    } else {
      try {
        await Promise.all(this.buildFolders.map(file => fs.rm(CommonUtil.resolveWorkspace(this.ctx, file), { force: true, recursive: true })));
      } catch { }
      return console.log(`Cleaned ${this.ctx.workspace.path}:`, this.buildFolders);
    }
  }

  /** Stream events */
  async events(type: string, handler: (event: unknown) => unknown): Promise<void> {
    if (isComplilerEventType(type)) {
      for await (const event of this.client.fetchEvents(type)) { await handler(event); }
    } else {
      throw new Error(`Unknown event type: ${type}`);
    }
  }

  async eventsStdout(type: string): Promise<void> {
    await this.events(type, async event => {
      process.stdout.write(`${JSON.stringify(event)}\n`) ||
        await new Promise(resolve => process.stdout.once('drain', resolve));
    });
  }

  /** Build the project */
  async build(): Promise<void> {
    Log.initLevel('info');
    await this.compile('build');
  }

  /** Build and watch the project */
  async watch(): Promise<void> {
    Log.initLevel('info');
    await this.compile('watch');
  }

  /** Set arguments and import module */
  async exec(mod: string, args?: string[]): Promise<unknown> {
    Log.initLevel('none');
    if (!(await this.client.isWatching())) { // Short circuit if we can
      Log.initLevel('error');
      await this.compile('build');
    }

    process.env.TRV_MANIFEST = CommonUtil.resolveWorkspace(this.ctx, this.ctx.build.outputFolder, 'node_modules', this.ctx.main.name); // Setup for running
    if (args) {
      process.argv = [process.argv0, mod, ...args];
    }
    // Return function to run import on a module
    return import(CommonUtil.resolveWorkspace(this.ctx, this.ctx.build.outputFolder, 'node_modules', mod));
  }

  /** Manifest entry point */
  async manifest(output?: string, prod?: boolean): Promise<void> {
    await this.compile('build', true);
    await CompilerSetup.exportManifest(this.ctx, output, prod); return;
  }
}

export default new Operations();