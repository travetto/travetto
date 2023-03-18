import { CliCommandShape, CliCommand } from '@travetto/cli';
import { GlobalEnvConfig } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { OpenApiService } from '../__index__';

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
    await RootRegistry.init();

    const instance = await DependencyRegistry.getInstance(OpenApiService);
    const result = instance.spec;

    if (this.output === '-' || !this.output) {
      console.log!(result);
    }
  }
}