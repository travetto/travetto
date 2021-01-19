import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * CLI Entry point for installing models
 */
export class ModelInstallPlugin extends BasePlugin {
  name = 'model:install';

  init(cmd: commander.Command) {
    return cmd
      .option('-e, --env [env]', 'Application environment (dev|prod|<other>)')
      .arguments('[provider] [models...');
  }

  async action() {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();
  }
}