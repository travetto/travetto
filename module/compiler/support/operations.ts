// @trv-no-transform
import fs from 'node:fs/promises';

import { getManifestContext, ManifestUtil, type ManifestContext } from '@travetto/manifest';

import type { CompilerLogLevel } from '../src/types.ts';
import { Log } from '../src/log.ts';
import { CompilerServer } from '../src/server/server.ts';
import { CompilerRunner } from '../src/server/runner.ts';
import { CompilerClient } from '../src/server/client.ts';
import { CommonUtil } from '../src/common.ts';
import { EventUtil } from '../src/event.ts';

class Operations {

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
  async compile(watch: boolean, logLevel: CompilerLogLevel = 'info'): Promise<void> {
    Log.initLevel(logLevel);

    const server = await new CompilerServer(this.ctx, watch).listen();
    const log = Log.scoped('main');

    // Wait for build to be ready
    if (server) {
      log.debug('Start Server');
      await server.processEvents(signal => CompilerRunner.runProcess(this.ctx, watch, signal));
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

  /** Set arguments and import module */
  async exec(module: string, args?: string[]): Promise<unknown> {
    if (!(await this.client.isWatching())) { // Short circuit if we can
      await this.compile(false, 'error');
    }

    Log.initLevel('none');
    process.env.TRV_MANIFEST = CommonUtil.resolveWorkspace(this.ctx, this.ctx.build.outputFolder, 'node_modules', this.ctx.main.name); // Setup for running
    if (args) {
      process.argv = [process.argv0, module, ...args];
    }
    // Return function to run import on a module
    return import(CommonUtil.resolveWorkspace(this.ctx, this.ctx.build.outputFolder, 'node_modules', module));
  }

  /** Manifest entry point */
  async manifest(output?: string, prod?: boolean): Promise<void> {
    const manifest = await ManifestUtil.buildManifest(this.ctx);
    const result = await ManifestUtil.exportManifest(manifest, output, prod);
    if (!result) {
      console.log(`Wrote manifest to ${output ?? 'stdout'}`);
    } else {
      await CommonUtil.writeStdout(2, result);
    }
  }
}

/**
 * Invoke the compiler
 */
export async function invoke(operation: string, args: string[]): Promise<unknown> {
  const ops = new Operations();

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

  const filtered = args.filter(arg => !arg.startsWith('-'));

  switch (operation) {
    case undefined:
    case 'help': console.log(help); break;
    case 'info': {
      const info = await ops.client.info();
      return CommonUtil.writeStdout(2, info);
    }
    case 'event': {
      if (!EventUtil.isComplilerEventType(filtered[0])) {
        throw new Error(`Unknown event type: ${filtered[0]}`);
      }
      for await (const event of ops.client.fetchEvents(filtered[0])) {
        await CommonUtil.writeStdout(0, event);
      }
      return;
    }
    case 'manifest': return ops.manifest(filtered[0], args.some(arg => arg === '--prod'));
    case 'exec': return ops.exec(filtered[0], args.slice(1));
    case 'build': return ops.compile(false);
    case 'clean': return ops.clean();
    case 'start':
    case 'watch': return ops.compile(true);
    case 'stop': return ops.stop();
    case 'restart': {
      await ops.stop();
      return ops.compile(true);
    }
    default: console.error(`\nUnknown trvc operation: ${operation}\n${help}`);
  }
}
