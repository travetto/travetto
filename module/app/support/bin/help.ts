import { CliUtil } from '@travetto/cli';

import type { ApplicationConfig } from '../../src/types';

export class HelpUtil {

  /**
   * Convert single ApplicationConfig into a stylized entry
   */
  static getAppUsage(app: ApplicationConfig): string {
    let usage = app.name;

    if (app.params) {
      usage = CliUtil.color`${{ identifier: usage }} ${app.params.map(p => {
        let type = p.type.toLowerCase();
        if (p.enum) {
          type = p.enum.values.map(x => `${x}`).join('|');
        }
        return !p.required ?
          (p.default !== undefined ?
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            CliUtil.color`[${{ param: p.name }}:${{ type }}=${{ input: p.default as string }}]` :
            CliUtil.color`[${{ param: p.name }}:${{ type }}]`
          ) : CliUtil.color`${{ param: p.name }}:${{ type }}`;
      }).join(' ')}`;
    }

    return usage;
  }

  /**
   * Generate list of all help entries
   */
  static generateAppHelpList(configs: ApplicationConfig[] | undefined): string {
    const choices = [];
    if (!configs || !configs.length) {
      return CliUtil.color`\nNo applications defined, use ${{ type: '@Application' }} to registry entry points`;
    }
    const cwdPrefix = `${process.cwd().__posix}/`;
    for (const conf of configs) {
      const lines = [];

      const usage = this.getAppUsage(conf);

      lines.push(CliUtil.color`${{ identifier: conf.name }} ${{ subtitle: conf.description }}`);
      lines.push(CliUtil.color`${{ subsubtitle: 'usage' }}: ${usage}`);
      lines.push(CliUtil.color`${{ subsubtitle: 'file' }}:  ${{ path: conf.filename.replace(cwdPrefix, '') }}`);

      // eslint-disable-next-line no-control-regex
      const len = lines.reduce((acc, v) => Math.max(acc, v.replace(/\x1b\[\d+m/g, '').length), 0);
      lines.splice(1, 0, '-'.repeat(len));

      choices.push(lines.join('\n     '));
    }
    return choices.map(x => `   ● ${x}`).join('\n\n');
  }
}