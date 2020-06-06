import { FrameworkUtil } from '@travetto/boot/src/framework';
import { BasePlugin } from './plugin-base';

/**
 * Manages loading and finding all plugins
 */
export class PluginManager {

  /**
   * Get list of all plugins available
   */
  static getPluginMapping() {
    const all = new Map<string, string>();
    for (const { file, stats } of FrameworkUtil.scan(f => /bin\/cli-/.test(f))) {
      if (stats.isFile()) {
        all.set(file.replace(/^.*\/bin\/.+-(.*?)[.][^.]*$/, (_, f) => f), file);
      }
    }
    return all;
  }

  /**
   * Load plugin module
   */
  static async loadPlugin(cmd: string, op?: (p: BasePlugin) => any): Promise<BasePlugin> {
    const command = cmd.replace(/:/g, '_');
    const f = this.getPluginMapping().get(command)!;
    if (!f) {
      throw new Error(`Unknown command: ${cmd}`);
    }
    for (const v of Object.values(require(f))) {
      try {
        // @ts-ignore
        const inst = new v();
        if (inst instanceof BasePlugin) {
          if (op) {
            await op(inst);
          }
          return inst;
        }
      } catch { }
    }
    throw new Error(`Not a valid plugin: ${cmd}`);
  }

  /**
   * Load all available plugins
   */
  static async loadAllPlugins(op?: (p: BasePlugin) => any | Promise<any>) {
    return Promise.all(
      [...this.getPluginMapping().keys()]
        .map(k => this.loadPlugin(k, op))
    );
  }
}