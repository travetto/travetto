import { Env } from '@travetto/runtime';
import { CliValidationError, CliCommandShape, cliTpl } from '@travetto/cli';
import { Registry } from '@travetto/registry';
import { Schema } from '@travetto/schema';

import type { ModelStorageSupport } from '../src/types/storage.ts';

import { ModelCandidateUtil } from './bin/candidate.ts';

/**
 * CLI Entry point for exporting model schemas
 */
@Schema()
export abstract class BaseModelCommand implements CliCommandShape {

  /** Application Environment */
  env?: string;

  abstract getOperation(): keyof ModelStorageSupport;

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async help(): Promise<string[]> {
    await Registry.init();

    const candidates = await ModelCandidateUtil.export(this.getOperation());
    return [
      cliTpl`${{ title: 'Providers' }}`,
      '-'.repeat(20),
      ...candidates.providers.map(type => cliTpl`  * ${{ type }}`),
      '',
      cliTpl`${{ title: 'Models' }}`,
      '-'.repeat(20),
      ...candidates.models.map(param => cliTpl`  * ${{ param }}`)
    ];
  }

  async validate(provider: string, models: string[]): Promise<CliValidationError | undefined> {
    await Registry.init();

    const candidates = await ModelCandidateUtil.export(this.getOperation());
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