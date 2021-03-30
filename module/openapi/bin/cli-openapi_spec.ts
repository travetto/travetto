import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ExecUtil } from '@travetto/boot';
import { EnvInit } from '@travetto/base/bin/init';

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecPlugin extends BasePlugin<{ output: string }> {
  name = 'openapi:spec';

  init(cmd: commander.Command) {
    return cmd.option('-o, --output [output]', 'Output files', './openapi.yml');
  }

  envInit() {
    EnvInit.init({
      watch: false, debug: '0',
      set: { API_SPEC_OUTPUT: this.opts.output }
    });
  }

  async action() {
    const result = await ExecUtil.workerMain(require.resolve('./generate')).message;

    if (this.opts.output === '-' || !this.opts.output) {
      console.log!(result);
    }
  }
}