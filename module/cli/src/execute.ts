import * as commander from 'commander';

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
  static async runCompletion(args: string[]) {
    const compl: CompletionConfig = { all: [], task: {} };
    await PluginManager.loadAllPlugins(x => x.setupCompletion(compl));
    const res = await CliUtil.getCompletion(compl, args.slice(3));
    console.log(res.join(' '));
    return;
  }

  /**
   * Run plugin
   */
  static async runPlugin(args: string[]) {
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
      return plugin.showHelp(err);
    }
  }

  /**
   * Execute the command line
   * @param args argv
   */
  static async run(args: string[]) {
    commander.version(version);
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