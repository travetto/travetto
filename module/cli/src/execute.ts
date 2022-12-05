import { program as commander } from 'commander';

import { PackageUtil } from '@travetto/manifest';
import { ModuleIndex } from '@travetto/boot';

import { CliCommandManager } from './command-manager';
import { HelpUtil } from './help';

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Run command
   */
  static async runCommand(args: string[]): Promise<void> {
    const cmd = args[2];

    let command;

    try {
      // Load a single command
      command = await CliCommandManager.loadCommand(cmd);
      await command.setup(commander);
    } catch (err) {
      return HelpUtil.showHelp(commander, `Unknown command ${cmd}`);
    }

    try {
      if (args.includes('-h') || args.includes('--help')) {
        return command.showHelp();
      } else {
        await commander.parseAsync(args);
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
  static async run(args: string[]): Promise<void> {
    const width = +(process.env.TRV_CONSOLE_WIDTH ?? process.stdout.columns ?? 120);
    commander
      .version(PackageUtil.getFrameworkVersion())
      .configureOutput({ getOutHelpWidth: () => width, getErrHelpWidth: () => width });

    const cmd = args[2];

    if (cmd === 'main') {
      const mainFile = ModuleIndex.resolveFileImport(process.argv[3])!;
      await import(process.env.TRV_MAIN = mainFile);
    } else if (cmd && !cmd.startsWith('-')) {
      await this.runCommand(args);
    } else {
      // Load all commands
      await CliCommandManager.loadAllCommands(x => x.setup(commander));
      HelpUtil.showHelp(commander);
    }
  }
}