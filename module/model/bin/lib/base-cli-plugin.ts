import { BasePlugin, OptionConfig } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { EnvInit } from '@travetto/base/bin/init';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage';

import { ModelCandidateUtil } from './candidate';

type Options = {
  env: OptionConfig<string>;
};

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelPlugin extends BasePlugin<Options> {

  restoreEnv?: (err: Error) => unknown;

  op: keyof ModelStorageSupport;

  resolve = ModelCandidateUtil.resolve.bind(ModelCandidateUtil);

  envInit(): void {
    EnvInit.init();
  }

  override async build(): Promise<void> {
    await super.build();
    const { ConsoleManager, PhaseManager } = await import('@travetto/base');
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
    await this.showHelp(err, color`   
${{ title: 'Providers' }}:
${providers.map(p => color`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${models.map(p => color`  * ${{ param: p }}`).join('\n')}
`);
  }

  async validate(provider: string, models: string[]): Promise<void> {
    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    if (!provider) {
      return await this.usage(candidates);
    } else {
      if (!candidates.providers.includes(provider)) {
        await this.usage(candidates, color`${{ param: provider }} is not a valid provider`);
      }
      const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
      if (badModel) {
        await this.usage(candidates, color`${{ param: badModel }} is not a valid model`);
      }
    }
  }
}