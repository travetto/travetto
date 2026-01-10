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

export class Operations {

  static #instance: Operations = new Operations();

  static getInstance(): Operations {
    return Operations.#instance;
  }

  /**
   * Invoke the compiler
   */
  static async invokeCompiler(operation: string, args: string[]): Promise<void> {

    const filtered = args.filter(arg => !arg.startsWith('-'));

    const help = `
npx trvc [command]

Available Commands:
 * start|watch                - Run the compiler in watch mode
 * stop                       - Stop the compiler if running
 * restart                    - Restart the compiler in watch mode
 * build                      - Ensure the project is built and upto date
 * clean                      - Clean out the output and compiler caches
 * info                       - Retrieve the compiler information, if running
 * event <log|progress|state> - Watch events in realtime as newline delimited JSON
 * exec <file> [...args]      - Allow for compiling and executing an entrypoint file
 * manifest --prod [output]   - Generate the project manifest
`;

    switch (operation) {
      case undefined:
      case 'help': console.log(help); break;
      case 'info': this.#instance.info(); break;
      case 'event': this.#instance.events(filtered[0]); break;
      case 'manifest': this.#instance.manifest(filtered[0], args.some(arg => arg === '--prod')); break;
      case 'exec': this.#instance.exec(filtered[0], args.slice(1)); break;
      case 'build': this.#instance.build(); break;
      case 'clean': this.#instance.clean(); break;
      case 'start':
      case 'watch': this.#instance.watch(); break;
      case 'stop': this.#instance.stop(); break;
      case 'restart': this.#instance.restart(); break;
      default: console.error(`\nUnknown trvc operation: ${operation}\n${help}`);
    }
  }

  /**
   * Invoke a module, ensuring compilation first
   */
  static invokeModule(entryModule: string): void {
    this.#instance.exec(entryModule);
  }

  client: CompilerClient;
  buildFolders: string[];
  ctx: ManifestContext;

  constructor(ctx?: ManifestContext) {
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
  infoJSON(): Promise<CompilerServerInfo | undefined> {
    return this.client.info();
  }

  async info(): Promise<void> {
    const info = await this.infoJSON();
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
  async eventsJSON(type: string, handler: (event: unknown) => unknown): Promise<void> {
    if (isComplilerEventType(type)) {
      for await (const event of this.client.fetchEvents(type)) { await handler(event); }
    } else {
      throw new Error(`Unknown event type: ${type}`);
    }
  }

  async events(type: string): Promise<void> {
    await this.eventsJSON(type, async event => {
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