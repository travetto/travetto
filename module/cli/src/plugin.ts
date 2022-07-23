import { SourceIndex } from '@travetto/boot/src/internal/source';

import { color } from './color';
import { BasePlugin } from './plugin-base';

const PLUGIN_PACKAGE = [
  [/^run$/, 'app', true],
  [/^compile$/, 'compiler', true],
  [/^test$/, 'test', false],
  [/^command:service$/, 'command', true],
  [/^model:(install|export)$/, 'model', true],
  [/^openapi:(spec|client)$/, 'openapi', true],
  [/^email:(compile|dev)$/, 'email-template', false],
  [/^pack(:assemble|:zip|:docker)?$/, 'pack', false],
] as const;

/**
 * Manages loading and finding all plugins
 */
export class PluginManager {

  /**
   * Get list of all plugins available
   */
  static getPluginMapping(): Map<string, string> {
    const all = new Map<string, string>();
    for (const { file } of SourceIndex.find({ folder: 'bin', filter: /bin\/cli-/ })) {
      all.set(file.replace(/^.*\/bin\/.+?-(.*?)[.][^.]*$/, (_, f) => f), file);
    }
    return all;
  }

  /**
   * Load plugin module
   */
  static async loadPlugin(cmd: string, op?: (p: BasePlugin) => unknown): Promise<BasePlugin> {
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
    const values = Object.values<{ new(...args: unknown[]): unknown }>(await import(f));
    for (const v of values) {
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
  static async loadAllPlugins(op?: (p: BasePlugin) => unknown | Promise<unknown>): Promise<BasePlugin[]> {
    return Promise.all(
      [...this.getPluginMapping().keys()]
        .sort((a, b) => a.localeCompare(b))
        .map(k => this.loadPlugin(k, op))
    );
  }
}