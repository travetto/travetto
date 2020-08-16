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
    const allModes = await PackUtil.getListOfPackModes();
    const mode = allModes.find(x => process.argv.find(a => a === x.key));
    const flags = (await PackUtil.getManager(mode?.file)).flags ?? {};

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
    const allModes = await PackUtil.getListOfPackModes();
    const mode = allModes.find(x => process.argv.find(a => a === x.key));
    await PackUtil.pack(mode?.file, { flags: this._cmd.opts() as any });
    console.log(color`\n${{ success: 'Successfully' }} wrote project to ${{ path: this._cmd.workspace }}`);
  }

  async complete() {
    const apps = await PackUtil.getListOfPackModes();
    return { '': apps.map(x => x.key) };
  }
}