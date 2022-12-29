import { CliCommand, cliTpl, OptionConfig } from '@travetto/cli';
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

  getArgs(): string {
    return '[provider] [models...]';
  }

  getOptions(): Options {
    return { env: this.option({ desc: 'Application environment' }) };
  }

  async usage({ providers, models }: { providers: string[], models: string[] }, err = ''): Promise<void> {
    await this.showHelp(err, cliTpl`   
${{ title: 'Providers' }}:
${providers.map(p => cliTpl`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${models.map(p => cliTpl`  * ${{ param: p }}`).join('\n')}
`);
  }

  async validate(provider: string, models: string[]): Promise<void> {
    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    if (!provider) {
      return await this.usage(candidates);
    } else {
      if (!candidates.providers.includes(provider)) {
        await this.usage(candidates, cliTpl`${{ param: provider }} is not a valid provider`);
      }
      const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
      if (badModel) {
        await this.usage(candidates, cliTpl`${{ param: badModel }} is not a valid model`);
      }
    }
  }
}