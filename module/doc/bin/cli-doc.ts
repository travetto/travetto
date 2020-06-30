import * as commander from 'commander';
import * as fs from 'fs';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { CliDocUtil } from './lib/util';

/**
 * Command line support for generating module docs.
 */
export class DocPlugin extends BasePlugin {
  name = 'doc';

  init(cmd: commander.Command) {
    return cmd
      .option('-o, --output <output>', 'Output file')
      .option('-f, --format <format>', 'Format', 'md')
      .option('-w, --watch <watch>', 'Watch', false);
  }

  async action() {
    await CliDocUtil.init();

    const renderer = await CliDocUtil.getRenderer(this._cmd.format);

    if (!this._cmd.output) {
      console.log(await CliDocUtil.generate(renderer));
    } else {
      const finalName = await CliDocUtil.getOutputLoc(this._cmd.output);

      const write = async () => fs.writeFileSync(finalName, await CliDocUtil.generate(renderer), 'utf8');

      if (this._cmd.watch) {
        await CliDocUtil.watchFile('README.ts', write);
      } else {
        await write();
      }
    }
  }
}