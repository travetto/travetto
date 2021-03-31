import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ExecUtil } from '@travetto/boot';
import { EnvInit } from '@travetto/base/bin/init';

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecPlugin extends BasePlugin {
  name = 'openapi:spec';

  getOptions() {
    return { output: this.option({ desc: 'Output files', def: './openapi.yml' }) };
  }

  envInit() {
    EnvInit.init({
      watch: false, debug: '0',
      set: { API_SPEC_OUTPUT: this.cmd.output }
    });
  }

  async action() {
    const result = await ExecUtil.workerMain(require.resolve('./generate')).message;

    if (this.cmd.output === '-' || !this.cmd.output) {
      console.log!(result);
    }
  }
}