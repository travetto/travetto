import { program as commander } from 'commander';

import { PackageUtil } from '@travetto/manifest';
import { GlobalTerminal } from '@travetto/terminal';

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
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    await GlobalTerminal.init();

    commander
      .version(PackageUtil.getFrameworkVersion())
      .configureOutput({
        getOutHelpWidth: () => GlobalTerminal.width,
        getErrHelpWidth: () => GlobalTerminal.width
      });

    const { init } = await import('@travetto/base/support/init.js');
    await init();

    const [, , cmd, ...args] = argv;
    if (cmd && !cmd.startsWith('-')) {
      await this.runCommand(cmd, args);
    } else {
      // Load all commands
      await CliCommandManager.loadAllCommands(x => x.setup(commander));
      HelpUtil.showHelp(commander);
    }
  }
}