// @trv-no-transform
import { getManifestContext, ManifestUtil } from '@travetto/manifest';

import { Log } from '../src/log.ts';
import { CompilerManager } from '../src/server/manager.ts';
import { CompilerClient } from '../src/server/client.ts';
import { CommonUtil } from '../src/common.ts';
import { EventUtil } from '../src/event.ts';

const hasColor = (process.stdout.isTTY && /^(0)*$/.test(process.env.NO_COLOR ?? '')) || /1\d*/.test(process.env.FORCE_COLOR ?? '');
const color = (code: number) => (value: string): string => hasColor ? `\x1b[${code}m${value}\x1b[0m` : `${value}`;
const STYLE = { error: color(91), title: color(36), main: color(92), command: color(35), arg: color(37), description: color(33), };

async function showHelp(errorMessage?: string): Promise<void> {
  const COMMANDS = [
    { name: 'start', description: 'Run the compiler in watch mode' },
    { name: 'stop', description: 'Stop the compiler if running' },
    { name: 'restart', description: 'Restart the compiler in watch mode' },
    { name: 'build', description: 'Ensure the project is built and upto date' },
    { name: 'clean', description: 'Clean out the output and compiler caches' },
    { name: 'info', description: 'Retrieve the compiler information, if running' },
    { name: 'event', args: ['<log|progress|state>'], description: 'Watch events in realtime as newline delimited JSON' },
    { name: 'exec', args: ['<file>', '[...args]'], description: 'Allow for compiling and executing an entrypoint file' },
    { name: 'manifest', args: ['[output]'], description: 'Generate the project manifest' },
    { name: 'manifest:production', args: ['[output]'], description: 'Generate the production project manifest' }
  ]
    .map(config => ({ args: [], ...config }))
    .map(config => ({ ...config, commandLength: [config.name, ...config.args].join(' ').length }));

  const commandWidth = Math.max(...COMMANDS.map(config => config.commandLength));

  console.log([
    ...(errorMessage ? ['', STYLE.error(errorMessage)] : []),
    '', `${STYLE.main('trvc')} ${STYLE.command('[command]')}`,
    '', STYLE.title('Available Commands'),
    ...COMMANDS.map(({ name, args, description, commandLength }) => [
      '*', STYLE.command(name), ...args.map(arg => STYLE.arg(arg)),
      ' '.repeat(commandWidth - commandLength), STYLE.description(description)
    ].join(' ')),
    ''
  ].join('\n'));
}

/**
 * Invoke the compiler
 */
export async function invoke(command?: string, args: string[] = []): Promise<unknown> {
  if (command === undefined) {
    [command, ...args] = process.argv.slice(2);
  }
  const ctx = getManifestContext();
  const client = new CompilerClient(ctx, Log.scoped('client'));

  Log.initLevel('error');
  Log.root = ctx.workspace.path;

  switch (command) {
    case undefined: return showHelp();
    case 'start':
    case 'watch': return CompilerManager.compile(ctx, client, { watch: true });
    case 'build': return CompilerManager.compile(ctx, client, { watch: false });
    case 'restart': return CompilerManager.compile(ctx, client, { watch: true, forceRestart: true });
    case 'info': {
      const info = await client.info();
      return CommonUtil.writeStdout(2, info);
    }
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
      if (command === 'manifest:production') {
        manifest = ManifestUtil.createProductionManifest(manifest);
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
      process.env.TRV_MANIFEST = CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', ctx.main.name); // Setup for running
      const importTarget = CommonUtil.resolveWorkspace(ctx, ctx.build.outputFolder, 'node_modules', args[0]).replace(/\.ts$/, '.js');
      process.argv = [process.argv0, importTarget, ...args.slice(1)];
      // Return function to run import on a module
      return import(importTarget);
    }
    default: return showHelp(`Unknown trvc command: ${command}`);
  }
}