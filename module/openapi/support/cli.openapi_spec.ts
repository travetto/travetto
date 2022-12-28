import { CliCommand, OptionConfig } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';

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

  envInit(): GlobalEnvConfig {
    return {
      debug: false,
      set: { API_SPEC_OUTPUT: this.cmd.output }
    };
  }

  async action(): Promise<void> {
    const result = await ExecUtil.worker(RootIndex.resolveFileImport('@travetto/openapi/support/main.generate.ts')).message;

    if (this.cmd.output === '-' || !this.cmd.output) {
      console.log!(result);
    }
  }
}