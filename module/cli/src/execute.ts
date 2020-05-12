
import * as commander from 'commander';
import { CliUtil } from './util';
import { CompletionConfig } from './types';
import { PluginManager } from './plugin';

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Run tab completion given the full args list
   */
  static async runcCompletion(args: string[]) {
    const compl: CompletionConfig = { all: [], task: {} };
    await PluginManager.loadAllPlugins(x => x.complete(compl));
    const res = await CliUtil.getCompletion(compl, args.slice(3));
    console.log(res.join(' '));
    return;
  }

  /**
   * Run plugin
   */
  static async runPlugin(args: string[]) {
    const cmd = args[2];

    try {
      // Load a single plugin
      const plugin = await PluginManager.loadPlugin(cmd);

      if (plugin.setup) {
        await plugin.setup();
      }

      const prog = await plugin.init();

      if (args.includes('-h') || args.includes('--help')) {
        CliUtil.showHelp(prog);
      } else {
        commander.parse(args);
      }
    } catch (err) {
      CliUtil.showHelp(commander, `Unknown command ${cmd}`);
    }
  }

  /**
   * Show all help
   */
  static async runHelp() {
    // Load all plugins
    await PluginManager.loadAllPlugins(x => x.init());
    // Show help for all available commands
    CliUtil.showHelp(commander);
  }

  /**
   * Execute the command line
   * @param args argv
   */
  static async run(args: string[]) {
    commander.version(require('../package.json').version);

    const cmd = args[2];

    if (cmd === 'complete') {
      await this.runcCompletion(args);
    } else if (cmd && !cmd.startsWith('-')) {
      await this.runPlugin(args);
    } else {
      await this.runHelp();
    }
  }
}