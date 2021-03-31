import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { EnvInit } from '@travetto/base/bin/init';

import { DocBinUtil } from './lib/util';

/**
 * Command line support for generating module docs.
 */
export class DocPlugin extends BasePlugin {
  name = 'doc';

  getOptions() {
    return {
      output: this.listOption({ desc: 'Output files' }),
      format: this.option({ desc: 'Format', def: 'md' }),
      watch: this.boolOption({ desc: 'Watch' })
    };
  }

  async envInit() {
    EnvInit.init({
      debug: '0',
      append: {
        TRV_SRC_LOCAL: 'doc',
        TRV_RESOURCES: 'doc/resources'
      },
      set: {
        TRV_CONSOLE_WIDTH: '140',
        TRV_COLOR: '0',
        TRV_LOG_PLAIN: '1'
      }
    });
  }

  async action() {
    await DocBinUtil.generate({ output: this.cmd.output, watch: this.cmd.watch, format: this.cmd.format });
  }
}