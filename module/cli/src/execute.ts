import { program as commander } from 'commander';

import { CliUtil } from './util';
import { CompletionConfig } from './types';
import { PluginManager } from './plugin';
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
    await PluginManager.loadAllPlugins(x => x.setupCompletion(cfg));
    const res = await CliUtil.getCompletion(cfg, args.slice(3));
    console.log(res.join(' '));
    return;
  }

  /**
   * Run plugin
   */
  static async runPlugin(args: string[]): Promise<void> {
    const cmd = args[2];

    let plugin;

    try {
      // Load a single plugin
      plugin = await PluginManager.loadPlugin(cmd);
      await plugin.setup(commander);
    } catch (err) {
      return HelpUtil.showHelp(commander, `Unknown command ${cmd}`);
    }

    try {
      if (args.includes('-h') || args.includes('--help')) {
        return plugin.showHelp();
      } else {
        commander.parse(args);
      }
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      return plugin.showHelp(err);
    }
  }

  /**
   * Execute the command line
   * @param args argv
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
        await this.runPlugin(args);
      } else {
        // Load all plugins
        await PluginManager.loadAllPlugins(x => x.setup(commander));
        HelpUtil.showHelp(commander);
      }
    }
  }
}