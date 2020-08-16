import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { CliUtil } from '@travetto/cli/src/util';

import { PackUtil } from './lib/pack';
import { PackManager } from './lib/pack-manager';

/**
 * Supports packing a project into a directory, ready for archiving
 */
export class PackPlugin extends BasePlugin {

  name = 'pack';

  async init(cmd: commander.Command) {
    const mode = process.argv.find(x => /@\S+\/\S+/.test(x));
    const flags = (await PackManager.get(mode)).flags ?? {};

    return cmd
      .arguments('[mode]')
      .option('-w --workspace [workspace]', 'Workspace directory', flags.workspace)
      .option('-k --keep-source [boolean]', 'Should source be preserved', CliUtil.isBoolean, flags.keepSource)
      .option('-r --readonly [boolean]', 'Build a readonly deployable', CliUtil.isBoolean, flags.readonly)
      .option('-z --zip [boolean]', 'Zip the workspace into an output file', CliUtil.isBoolean, flags.zip)
      .option('-o --output [output]', 'Output location when zipping', flags.output);
  }

  async help() {
    const lines = await PackUtil.getListOfPackModes();

    const out = [];
    if (lines.length) {
      out.push('', color`${{ title: 'Available Pack Modes:' }}`);
      for (const { key, file } of lines) {
        out.push(color`  * ${{ input: `${key}` }} [${{ path: file }}]`);
      }
      out.push('');
    }
    return out.join('\n');
  }

  async action() {
    await PackUtil.pack(this._cmd.args[0], { flags: this._cmd as any });
    console.log(color`\n${{ success: 'Successfully' }} wrote project to ${{ path: this._cmd.workspace }}`);
  }

  async complete() {
    const apps = await PackUtil.getListOfPackModes();
    return { '': apps.map(x => x.key) };
  }
}