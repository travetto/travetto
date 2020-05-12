import * as fs from 'fs';

import { FsUtil } from '@travetto/boot/src/fs';
import { Plugin } from './types';

/**
 * Manages loading and finding all plugins
 */
export class PluginManager {
  static readonly PREFIX = 'travetto-cli';

  /**
   * Get list of all plugins available
   */
  static getPluginMapping() {
    const all = new Map<string, string>();
    // Scan from the root directory
    const ROOT_DIR = `${FsUtil.cwd}/node_modules/@travetto`;
    if (FsUtil.existsSync(ROOT_DIR)) { // If installed and not a dev checkout
      // Find all folders
      const folders = fs.readdirSync(ROOT_DIR)
        .map(x => `${ROOT_DIR}/${x}/bin`)
        .filter(x => FsUtil.existsSync(x));

      // For each folder, load the plugin
      for (const folder of folders) {
        const files = fs.readdirSync(folder)
          .filter(x => x.startsWith(this.PREFIX));

        for (const f of files) {
          all.set(f.replace(/[.][^.]*$/, ''), `${folder}/${f}`);
        }
      }
    }

    // Check the bin folder
    const LOCAL_BIN = `${FsUtil.cwd}/bin`; // Support local dev
    if (FsUtil.existsSync(LOCAL_BIN)) {
      const files = fs.readdirSync(LOCAL_BIN)
        .filter(x => x.startsWith(this.PREFIX));

      for (const f of files) {
        all.set(f.replace(/[.][^.]*$/, ''), `${LOCAL_BIN}/${f}`);
      }
    }
    return all;
  }

  /**
   * Load plugin module
   */
  static async loadPlugin(cmd: string, op?: (p: Plugin) => any) {
    const command = `${this.PREFIX}-${cmd.replace(/:/g, '_')}`;
    const f = this.getPluginMapping().get(command)!;
    const plugin = require(FsUtil.toUnix(fs.realpathSync(f))) as Plugin;
    if (op) {
      await op(plugin);
    }
    return plugin;
  }

  /**
   * Load all available plugins
   */
  static async loadAllPlugins(op?: (p: Plugin) => any | Promise<any>) {
    return Promise.all(
      [...this.getPluginMapping().keys()]
        .map(k => this.loadPlugin(k, op))
    );
  }
}