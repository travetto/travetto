import { program as commander } from 'commander';

import { RootIndex, PackageUtil, path } from '@travetto/manifest';
import { GlobalTerminal } from '@travetto/terminal';
import { runMain } from '@travetto/base/support/init.main';

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
      command = (await CliCommandManager.loadCommand(cmd, { failOnMissing: true }))!;
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
    const width = GlobalTerminal.stream.columns;
    commander
      .version(PackageUtil.getFrameworkVersion())
      .configureOutput({ getOutHelpWidth: () => width, getErrHelpWidth: () => width });

    const cmd = args[2];

    if (cmd === 'main') {
      let mainFile = RootIndex.resolveFileImport(process.argv[3])!;
      if (!mainFile.startsWith('/')) {
        mainFile = path.join(RootIndex.manifest.mainModule, mainFile);
        mainFile = RootIndex.resolveFileImport(mainFile);
      }
      await runMain((await import(mainFile)).main, process.argv.slice(4));
    } else if (cmd && !cmd.startsWith('-')) {
      await this.runCommand(args);
    } else {
      // Load all commands
      await CliCommandManager.loadAllCommands(x => x.setup(commander));
      HelpUtil.showHelp(commander);
    }
  }
}