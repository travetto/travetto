
import * as commander from 'commander';
import * as fs from 'fs';
import { FsUtil } from '@travetto/boot';

import { Util, CompletionConfig } from './util';

commander.version(require('../package.json').version);

const PREFIX = 'travetto-cli';
const noTS = (x: string) => x.replace(/\.ts$/, '');

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Get list of all plugins available
   */
  static getPluginMapping() {
    const all: Record<string, string> = {};
    // Scan from the root directory
    const ROOT_DIR = `${FsUtil.cwd}/node_modules/@travetto`;
    if (fs.existsSync(ROOT_DIR)) { // If installed and not a dev checkout
      // Find all folders
      const folders = fs.readdirSync(ROOT_DIR)
        .map(x => `${ROOT_DIR}/${x}/bin`)
        .filter(x => fs.existsSync(x));

      // For each folder, load the plugin
      for (const folder of folders) {
        const files = fs.readdirSync(folder)
          .filter(x => x.startsWith(PREFIX));

        for (const f of files) {
          all[noTS(f)] = `${folder}/${f}`;
        }
      }
    }

    // Check the bin folder
    const LOCAL_BIN = `${FsUtil.cwd}/bin`; // Support local dev
    if (fs.existsSync(LOCAL_BIN)) {
      const files = fs.readdirSync(LOCAL_BIN)
        .filter(x => x.startsWith(PREFIX));

      for (const f of files) {
        all[noTS(f)] = `${LOCAL_BIN}/${f}`;
      }
    }
    return all;
  }

  /**
   * Require plugin module
   */
  static requirePlugin(f: string) {
    return require(FsUtil.toUnix(fs.realpathSync(f)));
  }

  /**
   * Load all available plugins
   */
  static loadAllPlugins() {
    return Object.values(this.getPluginMapping()).map(f => this.requirePlugin(f));
  }

  /**
   * Load a single plugin
   */
  static loadSinglePlugin(cmd: string) {
    const mapping = this.getPluginMapping();
    const command = `${PREFIX}-${cmd.replace(/:/g, '_')}`;
    return this.requirePlugin(mapping[command]);
  }

  /**
   * Get code completion values
   */
  static async getCompletion(args: string[]) {
    const compl: CompletionConfig = { all: [], task: {} };

    // Load all plugins
    const cmd = args.shift() ?? '';
    await Promise.all(this.loadAllPlugins().map(x => x.complete(compl)));

    let last = cmd;
    let opts: string[] = [];

    // List all commands
    if (!compl.task[cmd]) {
      opts = compl.all;
    } else {
      // Look available sub commands
      last = args.pop() ?? '';
      const second = args.pop() ?? '';
      let flag = '';

      if (last in compl.task[cmd]) {
        flag = last;
        last = '';
      } else if (second in compl.task[cmd]) {
        // Look for available flags
        if (compl.task[cmd][second].includes(last)) {
          flag = '';
          last = '';
        } else {
          flag = second;
        }
      }
      opts = compl.task[cmd][flag];
    }

    return last ? opts.filter(x => x.startsWith(last)) : opts.filter(x => !x.startsWith('-'));
  }

  /**
   * Execute the command line
   * @param args argv
   */
  static async run(args: string[]) {
    const cmd = args[2];
    const hasCmd = cmd && !cmd.startsWith('-');

    // Detect help
    const wantsHelp = args.includes('-h') || args.includes('--help');

    // Run code completion
    if (cmd === 'complete') {
      this.getCompletion(args.slice(3)).then(x => console.log((x ?? []).join(' ')));
      return;
    }

    // If a command was passed in
    if (hasCmd) {
      try {
        // Load a single plugin
        const plugin = await this.loadSinglePlugin(cmd);
        if (plugin.setup) {
          await plugin.setup();
        }
        const prog = plugin.init();
        if (wantsHelp) {
          Util.showHelp(prog);
        }
      } catch (err) {
        Util.showHelp(commander, `Unknown command ${cmd}`);
      }
    } else {
      // Load all plugins
      this.loadAllPlugins().map(x => x.init());
      // Show help for all available commands
      if (!cmd || wantsHelp) {
        Util.showHelp(commander);
      }
    }

    commander.parse(args);
  }
}