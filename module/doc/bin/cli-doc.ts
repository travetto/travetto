import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { EnvInit } from '@travetto/base/bin/init';

import { DocBinUtil } from './lib/util';

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

  async envInit() {
    EnvInit.init({
      debug: '0',
      append: {
        TRV_SRC_LOCAL: 'doc',
        TRV_RESOURCES: 'doc/resources'
      },
      set: {
        TRV_COLOR: '0',
        TRV_LOG_PLAIN: '1'
      }
    });
  }

  async action() {
    await DocBinUtil.generate({ output: this._cmd.output, watch: this._cmd.watch, format: this._cmd.format });
  }
}