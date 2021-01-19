import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * CLI Entry point for exporting model schemas
 */
export class ModelExportPlugin extends BasePlugin {
  name = 'model:export';

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