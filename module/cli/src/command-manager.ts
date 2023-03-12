import { ShutdownManager } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import { cliTpl } from './color';
import { BaseCliCommand } from './command';
import { CliCommandRegistry } from './registry';

const COMMAND_PACKAGE = [
  [/^run$/, 'app', true],
  [/^test$/, 'test', false],
  [/^service$/, 'command', true],
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
   * Load command
   */
  static async loadCommand(cmd: string): Promise<BaseCliCommand | undefined> {
    const command = cmd.replace(/:/g, '_');
    const found = CliCommandRegistry.getCommandMapping().get(command)!;
    if (!found) {
      const matchedCfg = COMMAND_PACKAGE.find(([re]) => re.test(cmd));
      if (matchedCfg) {
        const [, pkg, prod] = matchedCfg;
        let install: string;
        switch (RootIndex.manifest.packageManager) {
          case 'npm': install = `npm i ${prod ? '' : '--save-dev '}@travetto/${pkg}`; break;
          case 'yarn': install = `yarn add ${prod ? '' : '--dev '}@travetto/${pkg}`; break;
        }
        console.error!(cliTpl`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: cmd }} please run:\n
${{ identifier: install }}
`);
        await ShutdownManager.exit(1);
      }
      throw new Error(`Unknown command: ${cmd}`);
    }
    const values = Object.values<{ new(...args: unknown[]): unknown }>(await import(found));
    for (const v of values) {
      const cfg = CliCommandRegistry.get(v);
      if (cfg) {
        const inst = new cfg.cls();
        if (inst.isActive && !inst.isActive()) {
          continue;
        }
        return inst;
      }
    }
    throw new Error(`Not a valid command: ${cmd}`);
  }

  /**
   * Load all available commands
   */
  static async loadAllCommands(): Promise<BaseCliCommand[]> {
    const commands = await Promise.all(
      [...CliCommandRegistry.getCommandMapping().keys()]
        .map(k => [k, this.loadCommand(k)] as const)
    );

    return await Promise.all(commands
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(async x => {
        await op?.(x[1]);
        return x[1];
      }));
  }
}