import { program as commander } from 'commander';

import { AutocompleteUtil, CompletionConfig } from './autocomplete';
import { CliCommandManager } from './command-manager';
import { HelpUtil } from './help';
import { version } from '../package.json';

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Run tab completion given the full args list
   */
  static async runCompletion(args: string[]): Promise<void> {
    const cfg: CompletionConfig = { all: [], task: {} };
    await CliCommandManager.loadAllCommands(x => x.setupCompletion(cfg));
    const res = await AutocompleteUtil.getCompletion(cfg, args.slice(3));
    console.log(res.join(' '));
    return;
  }

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
        commander.parse(args);
      }
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
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
      .version(version)
      .configureOutput({ getOutHelpWidth: () => width, getErrHelpWidth: () => width });

    const cmd = args[2];

    if (cmd === 'complete') {
      await this.runCompletion(args);
    } else {
      if (cmd && !cmd.startsWith('-')) {
        await this.runCommand(args);
      } else {
        // Load all commands
        await CliCommandManager.loadAllCommands(x => x.setup(commander));
        HelpUtil.showHelp(commander);
      }
    }
  }
}