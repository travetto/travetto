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

/**
 * Invoke the compiler
 */
export async function invoke(operation?: string, args: string[] = []): Promise<unknown> {
  if (operation === undefined) {
    [operation, ...args] = process.argv.slice(2);
  }

  const ctx = getManifestContext();
  const client = new CompilerClient(ctx, Log.scoped('client'));
  const filtered = args.filter(arg => !arg.startsWith('-'));
  const [primaryArg] = filtered;

  Log.initLevel('error');
  Log.root = ctx.workspace.path;

  switch (operation) {
    case undefined:
    case 'help': console.log(HELP); break;
    case 'start':
    case 'watch': return CompilerManager.compile(ctx, client, true);
    case 'build': return CompilerManager.compile(ctx, client, false);
    case 'info': {
      const info = await client.info();
      return CommonUtil.writeStdout(2, info);
    }
    case 'event': {
      if (!EventUtil.isComplilerEventType(primaryArg)) {
        throw new Error(`Unknown event type: ${primaryArg}`);
      }
      for await (const event of client.fetchEvents(primaryArg)) {
        await CommonUtil.writeStdout(0, event);
      }
      break;
    }
    case 'manifest': {
      const manifest = await ManifestUtil.buildManifest(ctx);
      const result = await ManifestUtil.exportManifest(manifest, primaryArg, args.some(arg => arg === '--prod'));
      if (!result) {
        console.log(`Wrote manifest to ${primaryArg ?? 'stdout'}`);
      } else {
        await CommonUtil.writeStdout(2, result);
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
    case 'restart': {
      await client.stop();
      return CompilerManager.compile(ctx, client, true);
    }
    case 'exec': {
      await CompilerManager.compileIfNecessary(ctx, client);
      Log.initLevel('none');
      process.env.TRV_MANIFEST = CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.main.name); // Setup for running
      if (args) {
        process.argv = [process.argv0, primaryArg, ...args.slice(1)];
      }
      // Return function to run import on a module
      return import(CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', primaryArg));
    }
    default: console.error(`\nUnknown trvc operation: ${operation}\n${HELP}`);
  }
}