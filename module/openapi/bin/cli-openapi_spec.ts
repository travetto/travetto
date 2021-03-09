import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ExecUtil } from '@travetto/boot';
import { EnvInit } from '@travetto/base/bin/init';

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecPlugin extends BasePlugin {
  name = 'openapi:spec';

  init(cmd: commander.Command) {
    return cmd.option('-o, --output [output]', 'Output files', './openapi.yml');
  }

  async action() {
    EnvInit.init({
      watch: false, debug: '0',
      set: { API_SPEC_OUTPUT: this._cmd.output }
    });

    const result = await ExecUtil.workerMain(require.resolve('./generate')).message;

    if (this._cmd.output === '-' || !this._cmd.output) {
      console.log!(result);
    }
  }
}