import { FrameworkUtil } from '@travetto/boot/src/framework';

import { color } from './color';
import { BasePlugin } from './plugin-base';

const PLUGIN_PACKAGE = [
  [/^run$/, 'app', true],
  [/^compile$/, 'compiler', true],
  [/^test(:lerna)?$/, 'test', false],
  [/^command:service$/, 'command', true],
  [/^model:sql-schema$/, 'model-sql', true],
  [/^openapi:(spec|client)$/, 'openapi', true],
  [/^model:es-schema$/, 'model-elasticserch', true],
  [/^email:(compile|dev)$/, 'email-template', false],
  [/^pack(:assemble|:zip|:docker)?$/, 'pack', false],
] as [patt: RegExp, pkg: string, prod: boolean][];

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
        all.set(file.replace(/^.*\/bin\/.+?-(.*?)[.][^.]*$/, (_, f) => f), file);
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
      const cfg = PLUGIN_PACKAGE.find(([re]) => re.test(cmd));
      if (cfg) {
        const [, pkg, prod] = cfg;
        console.error(color`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: cmd }} please run:\n
${{ identifier: `npm i ${prod ? '' : '--save-dev '}@travetto/${pkg}` }}`);
        process.exit(1);
      }
      throw new Error(`Unknown command: ${cmd}`);
    }
    for (const v of Object.values(require(f)) as { new(...args: any[]): any }[]) {
      try {
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
        .sort((a, b) => a.localeCompare(b))
        .map(k => this.loadPlugin(k, op))
    );
  }
}