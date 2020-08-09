import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { CliUtil } from '@travetto/cli/src/util';

import { PackUtil } from './lib/pack';

/**
 * Supports packing a project into a directory, ready for archiving
 */
export class PackPlugin extends BasePlugin {

  name = 'pack';

  async init(cmd: commander.Command) {
    const flags = (await PackUtil.getConfig(
      await PackUtil.getModeConfig(...process.argv.slice(3).filter(x => !x.startsWith('-')))
    )).defaultFlags ?? {};

    return cmd
      .arguments('[mode]')
      .option('-w --workspace [workspace]', 'Workspace directory', 'dist/workspace')
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
    const config = await PackUtil.getConfig(
      await PackUtil.getModeConfig(this._cmd.args[0])
    );

    await PackUtil.pack(this._cmd.workspace, {
      keepSource: this._cmd.keepSource,
      readonly: this._cmd.readonly,
      zip: this._cmd.zip,
      output: this._cmd.output
    }, config);

    console.log(color`\n${{ success: 'Successfully' }} wrote project to ${{ path: this._cmd.workspace }}`);
  }

  async complete() {
    const apps = await PackUtil.getListOfPackModes();
    return { '': apps.map(x => x.key) };
  }
}