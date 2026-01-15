// @trv-no-transform
import { getManifestContext, ManifestUtil } from '@travetto/manifest';

import { Log } from '../src/log.ts';
import { CompilerManager } from '../src/server/manager.ts';
import { CompilerClient } from '../src/server/client.ts';
import { CommonUtil } from '../src/common.ts';
import { EventUtil } from '../src/event.ts';

const HELP = `
npx trvc [command]

Available Commands:
 * start|watch                  - Run the compiler in watch mode
 * stop                         - Stop the compiler if running
 * restart                      - Restart the compiler in watch mode
 * build                        - Ensure the project is built and upto date
 * clean                        - Clean out the output and compiler caches
 * info                         - Retrieve the compiler information, if running
 * event <log|progress|state>   - Watch events in realtime as newline delimited JSON
 * exec <file> [...args]        - Allow for compiling and executing an entrypoint file
 * manifest [output]            - Generate the project manifest
 * manifest:production [output] - Generate the production project manifest
`;

/**
 * Invoke the compiler
 */
export async function invoke(operation?: string, args: string[] = []): Promise<unknown> {
  if (operation === undefined) {
    [operation, ...args] = process.argv.slice(2);
  }
  const ctx = getManifestContext();
  const client = new CompilerClient(ctx, Log.scoped('client'));

  Log.initLevel('error');
  Log.root = ctx.workspace.path;

  switch (operation) {
    case undefined:
    case 'help': console.log(HELP); break;
    case 'start':
    case 'watch': return CompilerManager.compile(ctx, client, { watch: true });
    case 'build': return CompilerManager.compile(ctx, client, { watch: false });
    case 'restart': return CompilerManager.compile(ctx, client, { watch: true, forceRestart: true });
    case 'info': return CommonUtil.writeStdout(2, await client.info());
    case 'event': {
      if (!EventUtil.isComplilerEventType(args[0])) {
        throw new Error(`Unknown event type: ${args[0]}`);
      }
      for await (const event of client.fetchEvents(args[0])) {
        await CommonUtil.writeStdout(0, event);
      }
      break;
    }
    case 'manifest:production':
    case 'manifest': {
      let manifest = await ManifestUtil.buildManifest(ctx);
      if (operation === 'manifest:production') {
        manifest = await ManifestUtil.createProductionManifest(manifest);
      }
      if (args[0]) {
        await ManifestUtil.writeManifestToFile(args[0], manifest);
        console.log(`Wrote manifest to ${args[0]}`);
      } else {
        await CommonUtil.writeStdout(2, manifest);
      }
      break;
    }
    case 'clean': {
      await client.clean(true);
      console.log(`Clean triggered ${ctx.workspace.path}`);
      break;
    }
    case 'stop': {
      if (await client.stop()) {
        console.log(`Stopped server ${ctx.workspace.path}: ${client.url}`);
      } else {
        console.log(`Server not running ${ctx.workspace.path}: ${client.url}`);
      }
      break;
    }
    case 'exec': {
      await CompilerManager.compileIfNecessary(ctx, client);
      Log.initLevel('none');
      process.env.TRV_MANIFEST = CommonUtil.resolveCompiledOutput(ctx, ctx.main.name); // Setup for running
      const importTarget = CommonUtil.resolveCompiledOutput(ctx, args[0]);
      process.argv = [process.argv0, importTarget, ...args.slice(1)];
      // Return function to run import on a module
      return import(importTarget);
    }
    default: {
      process.exitCode = 1;
      console.error(`\nUnknown trvc operation: ${operation}\n${HELP}`);
    }
  }
}