import { BaseModelPlugin } from './lib/base-cli-plugin';
import { CliModelInstallUtil } from './lib/install';

/**
 * CLI Entry point for installing models
 */
export class ModelInstallPlugin extends BaseModelPlugin {
  name = 'model:install';

  async run(provider: string, models: string[]) {
    CliModelInstallUtil.install(provider, models);
  }
}