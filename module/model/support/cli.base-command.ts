import { ConsoleManager, PhaseManager } from '@travetto/boot';

import { CliCommand, CliUtil, OptionConfig } from '@travetto/cli';
import { EnvInit } from '@travetto/base/support/bin/env';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage';

import { ModelCandidateUtil } from './bin/candidate';

type Options = {
  env: OptionConfig<string>;
};

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelCommand extends CliCommand<Options> {

  restoreEnv?: (err: Error) => unknown;

  op: keyof ModelStorageSupport;

  resolve = ModelCandidateUtil.resolve.bind(ModelCandidateUtil);

  envInit(): void {
    EnvInit.init();
  }

  override async build(): Promise<void> {
    await super.build();
    ConsoleManager.exclude('debug');
    // Init
    await PhaseManager.run('init');
  }

  getArgs(): string {
    return '[provider] [models...]';
  }

  getOptions(): Options {
    return { env: this.option({ desc: 'Application environment' }) };
  }

  async usage({ providers, models }: { providers: string[], models: string[] }, err = ''): Promise<void> {
    await this.showHelp(err, CliUtil.color`   
${{ title: 'Providers' }}:
${providers.map(p => CliUtil.color`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${models.map(p => CliUtil.color`  * ${{ param: p }}`).join('\n')}
`);
  }

  async validate(provider: string, models: string[]): Promise<void> {
    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    if (!provider) {
      return await this.usage(candidates);
    } else {
      if (!candidates.providers.includes(provider)) {
        await this.usage(candidates, CliUtil.color`${{ param: provider }} is not a valid provider`);
      }
      const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
      if (badModel) {
        await this.usage(candidates, CliUtil.color`${{ param: badModel }} is not a valid model`);
      }
    }
  }
}