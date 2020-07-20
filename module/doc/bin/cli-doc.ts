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
      .option('-o, --output <output>', 'Output files', (v, ls) => { ls.push(v); return ls; }, [] as string[])
      .option('-f, --format <format>', 'Format', 'md')
      .option('-w, --watch <watch>', 'Watch', false);
  }

  async action() {
    await CliDocUtil.init();

    if (this._cmd.output) {

      const writers = await Promise.all((this._cmd.output as string[]).map(async (out) => {
        const fmt = out.includes('.') ? out.split('.').pop()! : this._cmd.format;
        const renderer = await CliDocUtil.getRenderer(fmt);
        const finalName = await CliDocUtil.getOutputLoc(out);
        return { renderer, finalName };
      }));

      const write = async () => {
        for (const { renderer, finalName } of writers) {
          const content = await CliDocUtil.generate('DOCS.js', renderer);
          fs.writeFileSync(finalName, content, 'utf8');
        }
      };

      if (this._cmd.watch) {
        await CliDocUtil.watchFile('DOCS.js', write);
      } else {
        await write();
      }
    } else {
      console.log(await CliDocUtil.getRenderer(this._cmd.format));
    }
  }
}