import { path } from '@travetto/manifest';
import { cliTpl } from '@travetto/cli';
import { TerminalUtil } from '@travetto/terminal';

import type { ApplicationConfig } from '../../src/types';

export class HelpUtil {

  /**
   * Convert single ApplicationConfig into a stylized entry
   */
  static getAppUsage(app: ApplicationConfig): string {
    let usage = app.moduleName ?? app.name;

    if (app.params) {
      usage = cliTpl`${{ identifier: usage }} ${app.params.map(p => {
        let type = p.type.toLowerCase();
        if (p.enum) {
          type = p.enum.values.map(x => `${x}`).join('|');
        }
        return !p.required ?
          (p.default !== undefined ?
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            cliTpl`[${{ param: p.name }}:${{ type }}=${{ input: p.default as string }}]` :
            cliTpl`[${{ param: p.name }}:${{ type }}]`
          ) : cliTpl`${{ param: p.name }}:${{ type }}`;
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
      return cliTpl`\nNo applications defined, use ${{ type: '@Application' }} to registry entry points`;
    }
    const cwdPrefix = `${path.cwd()}/`;
    for (const conf of configs) {
      const lines = [];

      const usage = this.getAppUsage(conf);

      lines.push(cliTpl`${{ identifier: conf.moduleName ?? conf.name }} ${{ subtitle: conf.description }}`);
      lines.push(cliTpl`${{ subsubtitle: 'usage' }}: ${usage}`);
      lines.push(cliTpl`${{ subsubtitle: 'file' }}:  ${{ path: conf.filename.replace(cwdPrefix, '') }}`);

      // eslint-disable-next-line no-control-regex
      const len = lines.reduce((acc, v) => Math.max(acc, TerminalUtil.removeAnsiSequences(v).length), 0);
      lines.splice(1, 0, '-'.repeat(len));

      choices.push(lines.join('\n     '));
    }
    return choices.map(x => `   ● ${x}`).join('\n\n');
  }
}