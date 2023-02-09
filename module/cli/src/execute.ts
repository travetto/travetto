import fs from 'fs/promises';
import { program as commander } from 'commander';

import { PackageUtil, path, RootIndex } from '@travetto/manifest';
import { GlobalTerminal } from '@travetto/terminal';
import { ShutdownManager } from '@travetto/base';

import { CliCommandManager } from './command-manager';
import { HelpUtil } from './help';

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Run command
   */
  static async runCommand(cmd: string, args: string[]): Promise<void> {
    let command;

    try {
      // Load a single command
      command = (await CliCommandManager.loadCommand(cmd, { failOnMissing: true }))!;
      await command.setup(commander);
    } catch (err) {
      return HelpUtil.showHelp(commander, `Unknown command ${cmd}`);
    }

    try {
      if (args.includes('-h') || args.includes('--help')) {
        return command.showHelp();
      } else {
        await commander.parseAsync([process.argv[0], process.argv[1], cmd, ...args]);
      }
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      } else {
        console.error(err);
      }
      return command.showHelp(err);
    }
  }

  /**
   * Run file expecting a main method
   */
  static async runMain(file: string, args: string[]): Promise<void> {
    try {
      // If referenced file exists
      if (await (fs.stat(path.resolve(file)).then(() => true, () => false))) {
        file = path.join(RootIndex.manifest.mainModule, file);
      }

      const imp = RootIndex.getFromImport(file)?.import;
      if (!imp) {
        throw new Error(`Unknown file: ${file}`);
      }

      const mod = await import(imp);
      await ShutdownManager.exitWithResponse(await mod.main(...args));
    } catch (err) {
      await ShutdownManager.exitWithResponse(err, true);
    }
  }

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    const { init } = await import('@travetto/base/support/init.js');
    await init();

    const width = GlobalTerminal.width;
    commander
      .version(PackageUtil.getFrameworkVersion())
      .configureOutput({ getOutHelpWidth: () => width, getErrHelpWidth: () => width });

    const [, , cmd, ...args] = argv;
    if (cmd === 'main') {
      const [file, ...rest] = args;
      await this.runMain(file, rest);
    } else if (cmd && !cmd.startsWith('-')) {
      await this.runCommand(cmd, args);
    } else {
      // Load all commands
      await CliCommandManager.loadAllCommands(x => x.setup(commander));
      HelpUtil.showHelp(commander);
    }
  }
}