import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ExecUtil } from '@travetto/boot';
import { EnvInit } from '@travetto/base/bin/init';

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecPlugin extends BasePlugin {
  name = 'openapi:spec';

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getOptions() {
    return { output: this.option({ desc: 'Output files', def: './openapi.yml' }) };
  }

  envInit(): void {
    EnvInit.init({
      debug: '0',
      set: { API_SPEC_OUTPUT: this.cmd.output }
    });
  }

  async action(): Promise<void> {
    const result = await ExecUtil.workerMain(require.resolve('./generate')).message;

    if (this.cmd.output === '-' || !this.cmd.output) {
      console.log!(result);
    }
  }
}