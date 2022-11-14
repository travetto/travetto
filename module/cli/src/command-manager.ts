import { ModuleIndex } from '@travetto/boot';

import { CliUtil } from './util';
import { CliCommand } from './command';

const COMMAND_PACKAGE = [
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
 * Manages loading and finding all commands
 */
export class CliCommandManager {

  /**
   * Get list of all commands available
   */
  static getCommandMapping(): Map<string, string> {
    const all = new Map<string, string>();
    for (const { output } of ModuleIndex.findSupport({ filter: /\/cli[.]/, checkProfile: false })) {
      all.set(output.replace(/^.*\/cli[.](.*?)[.][^.]+$/, (_, f) => f), output);
    }
    return all;
  }

  /**
   * Load command
   */
  static async loadCommand(cmd: string, op?: (p: CliCommand) => unknown): Promise<CliCommand> {
    const command = cmd.replace(/:/g, '_');
    const found = this.getCommandMapping().get(command)!;
    if (!found) {
      const cfg = COMMAND_PACKAGE.find(([re]) => re.test(cmd));
      if (cfg) {
        const [, pkg, prod] = cfg;
        console.error(CliUtil.color`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: cmd }} please run:\n
${{ identifier: `npm i ${prod ? '' : '--save-dev '}@travetto/${pkg}` }}`);
        process.exit(1);
      }
      throw new Error(`Unknown command: ${cmd}`);
    }
    const values = Object.values<{ new(...args: unknown[]): unknown }>(await import(found));
    for (const v of values) {
      try {
        const inst = new v();
        if (inst instanceof CliCommand) {
          if (op) {
            await op(inst);
          }
          return inst;
        }
      } catch { }
    }
    throw new Error(`Not a valid command: ${cmd}`);
  }

  /**
   * Load all available commands
   */
  static async loadAllCommands(op?: (p: CliCommand) => unknown | Promise<unknown>): Promise<CliCommand[]> {
    return Promise.all(
      [...this.getCommandMapping().keys()]
        .sort((a, b) => a.localeCompare(b))
        .map(k => this.loadCommand(k, op).catch(() => undefined))
    ).then((values) =>
      values.filter((cmd): cmd is CliCommand => !!cmd)
    );
  }
}