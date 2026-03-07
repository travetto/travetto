import { Env } from '@travetto/runtime';
import { type CliCommandShape, cliTpl, CliModuleFlag, CliProfilesFlag } from '@travetto/cli';
import { Registry } from '@travetto/registry';
import { Schema, type ValidationError } from '@travetto/schema';

import type { ModelStorageSupport } from '../src/types/storage.ts';

import { ModelCandidateUtil } from './bin/candidate.ts';

/**
 * CLI Entry point for exporting model schemas
 */
@Schema()
export abstract class BaseModelCommand implements CliCommandShape {

  static async validate(operation: keyof ModelStorageSupport, provider: string, models: string[]): Promise<ValidationError | undefined> {
    const candidates = await ModelCandidateUtil.export(operation);
    if (provider && !candidates.providers.includes(provider)) {
      return { message: `provider: ${provider} is not a valid provider`, source: 'arg', kind: 'invalid', path: 'provider' };
    }
    const badModel = models.find(model => model !== '*' && !candidates.models.includes(model));
    if (badModel) {
      return { message: `model: ${badModel} is not a valid model`, source: 'arg', kind: 'invalid', path: 'models' };
    }
  }

  @CliProfilesFlag()
  profile: string[];

  @CliModuleFlag({ short: 'm' })
  module: string;

  abstract getOperation(): keyof ModelStorageSupport;

  finalize(): void {
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

  abstract main(...args: unknown[]): ReturnType<CliCommandShape['main']>;
}