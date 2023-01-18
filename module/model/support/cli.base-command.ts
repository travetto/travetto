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

  usage({ providers, models }: { providers: string[], models: string[] }, err = ''): Promise<void> {
    return this.showHelp(err, cliTpl`   
${{ title: 'Providers' }}:
${providers.map(p => cliTpl`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${models.map(p => cliTpl`  * ${{ param: p }}`).join('\n')}
`, false);
  }

  async validate(provider: string, models: string[]): Promise<true | void> {
    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    if (!provider) {
      return this.usage(candidates);
    } else {
      if (!candidates.providers.includes(provider)) {
        return this.usage(candidates, cliTpl`${{ param: provider }} is not a valid provider`);
      }
      const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
      if (badModel) {
        return this.usage(candidates, cliTpl`${{ param: badModel }} is not a valid model`);
      }
    }
    return true;
  }
}