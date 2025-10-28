import { Env } from '@travetto/runtime';
import { CliValidationError, CliCommandShape, cliTpl } from '@travetto/cli';
import { RegistryV2 } from '@travetto/registry';

import type { ModelStorageSupport } from '../src/service/storage.ts';

import { ModelCandidateUtil } from './bin/candidate.ts';

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelCommand implements CliCommandShape {

  /** Application Environment */
  env?: string;

  abstract getOp(): keyof ModelStorageSupport;

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async help(): Promise<string[]> {
    await RegistryV2.init();

    const candidates = await ModelCandidateUtil.export(this.getOp());
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

  async validate(provider: string, models: string[]): Promise<CliValidationError | undefined> {
    await RegistryV2.init();

    const candidates = await ModelCandidateUtil.export(this.getOp());
    if (provider && !candidates.providers.includes(provider)) {
      return { message: `provider: ${provider} is not a valid provider`, source: 'arg' };
    }
    const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
    if (badModel) {
      return { message: `model: ${badModel} is not a valid model`, source: 'arg' };
    }
  }

  abstract main(...args: unknown[]): ReturnType<CliCommandShape['main']>;
}