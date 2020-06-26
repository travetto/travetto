import * as commander from 'commander';

import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { FsUtil } from '@travetto/boot';

/**
 * Command line support for generating module docs.
 */
export class DocPlugin extends BasePlugin {

  name = 'doc';

  init(cmd: commander.Command) {
    return cmd
      .option('-o, --output <output>', 'Output directory')
      .option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    await import(FsUtil.resolveUnix(FsUtil.cwd, './README.ts'));
  }

  complete() {
    return {
      '': ['--quiet', '--output']
    };
  }
}