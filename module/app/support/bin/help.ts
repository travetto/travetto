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
    const choices: string[][] = [];
    if (!configs || !configs.length) {
      return cliTpl`\nNo applications defined, use ${{ type: '@Application' }} to registry entry points`;
    }
    const cwdPrefix = `${path.cwd()}/`;
    for (const conf of configs) {
      const lines = [];

      const usage = this.getAppUsage(conf);

      lines.push(cliTpl`${{ param: conf.moduleName ?? conf.name }} ${{ title: conf.description }}`);
      lines.push(cliTpl`${{ subtitle: 'usage' }}: ${usage}`);
      lines.push(cliTpl`${{ subtitle: 'file' }}:  ${{ path: conf.filename.replace(cwdPrefix, '') }}`);
      choices.push(lines.map((x, i) => `   ${i === 0 ? '●' : ' '} ${x}`));
    }

    const allLines = choices.flat();
    const len = allLines.reduce((acc, v) => Math.max(acc, TerminalUtil.removeAnsiSequences(v).length), 0);
    const div = cliTpl`${{ subsubtitle: '     '.padEnd(len, '—') }}`;
    return choices.map(x => x.join('\n')).join(`\n\n${div}\n\n`);
  }
}