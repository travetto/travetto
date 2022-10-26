import { EnvInit } from '@travetto/base/support/bin/env';

import { CliCommand, OptionConfig } from '@travetto/cli';
import { ExecUtil } from '@travetto/base';

type Options = {
  output: OptionConfig<string>;
};

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecCommand extends CliCommand<Options> {
  name = 'openapi:spec';

  getOptions(): Options {
    return { output: this.option({ desc: 'Output files', def: './openapi.yml' }) };
  }

  envInit(): void {
    EnvInit.init({
      debug: '0',
      set: { API_SPEC_OUTPUT: this.cmd.output }
    });
  }

  async action(): Promise<void> {
    const result = await ExecUtil.worker(require.resolve('../support/main.generate')).message;

    if (this.cmd.output === '-' || !this.cmd.output) {
      console.log!(result);
    }
  }
}