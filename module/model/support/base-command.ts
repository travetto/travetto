import { ConsoleManager, GlobalEnvConfig } from '@travetto/base';
import { CliCommandShape, cliTpl } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';
import { Ignore, ValidationError } from '@travetto/schema';

import { ModelStorageSupport } from '../src/service/storage';

import { ModelCandidateUtil } from './bin/candidate';

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelCommand implements CliCommandShape {

  /** Application Environment */
  env?: string;

  @Ignore()
  op: keyof ModelStorageSupport;

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async help(): Promise<string[]> {
    await RootRegistry.init();

    const candidates = await ModelCandidateUtil.export(this.op);
    return [
      cliTpl`${{ title: 'Providers' }}`,
      '-'.repeat(20),
      ...candidates.providers.map(p => cliTpl`  * ${{ type: p }}`),
      '',
      cliTpl`${{ title: 'Models' }}`,
      '-'.repeat(20),
      ...candidates.models.map(p => cliTpl`  * ${{ param: p }}`)
    ];
  }

  async validate(provider: string, models: string[]): Promise<ValidationError | undefined> {
    ConsoleManager.setDebug(false);
    await RootRegistry.init();

    const candidates = await ModelCandidateUtil.export(this.op);
    if (!candidates.providers.includes(provider)) {
      return {
        message: `${provider} is not a valid provider`,
        path: 'provider',
        kind: 'invalid'
      };
    }
    const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
    if (badModel) {
      return {
        message: `${badModel} is not a valid model`,
        path: 'models',
        kind: 'invalid'
      };
    }
  }

  abstract main(...args: unknown[]): ReturnType<CliCommandShape['main']>;
}