import { CliCommandShape, CliCommand } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';

/**
 * CLI for outputting the open api spec to a local file
 */
@CliCommand()
export class OpenApiSpecCommand implements CliCommandShape {

  /** Output files */
  output = './openapi.yml';

  envInit(): GlobalEnvConfig {
    return {
      debug: false,
      set: { API_SPEC_OUTPUT: this.output }
    };
  }

  async main(): Promise<void> {
    const result = await ExecUtil.worker(
      RootIndex.resolveFileImport('@travetto/cli/support/entry.cli.ts'),
      ['main', '@travetto/openapi/support/bin/generate.ts'],
      { env: { TRV_OPENAPI_OUTPUT: this.output, TRV_OPENAPI_PERSIST: '1' } }
    ).message;

    if (this.output === '-' || !this.output) {
      console.log!(result);
    }
  }
}