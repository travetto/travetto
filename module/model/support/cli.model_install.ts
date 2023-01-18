import { cliTpl } from '@travetto/cli';
import { ConsoleManager } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';

import { BaseModelCommand } from './cli.base-command';
import { ModelInstallUtil } from './bin/install';

/**
 * CLI Entry point for installing models
 */
export class ModelInstallCommand extends BaseModelCommand {
  name = 'model:install';
  op = 'createModel' as const;

  async action(provider: string, models: string[]): Promise<void> {
    try {
      ConsoleManager.setDebug(false);
      await RootRegistry.init();

      if (!await this.validate(provider, models)) {
        return this.exit(1);
      }

      const resolved = await this.resolve(provider, models);
      await ModelInstallUtil.run(resolved.provider, resolved.models);
      console.log(cliTpl`${{ success: 'Successfully' }} installed ${{ param: models.length.toString() }} model(s)`);
    } catch (err) {
      console.error((err && err instanceof Error) ? err.message : err);
    }
  }
}