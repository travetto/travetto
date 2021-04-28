import { PathUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

import { ApplicationConfig } from '../../src/types';

export class HelpUtil {

  /**
   * Convert single ApplicationConfig into a stylized entry
   */
  static getAppUsage(app: ApplicationConfig) {
    let usage = app.name;

    if (app.params) {
      usage = color`${{ identifier: usage }} ${app.params.map(p => {
        let type = p.type.toLowerCase();
        if (p.enum) {
          type = p.enum.values.map(x => `${x}`).join('|');
        }
        return !p.required ?
          (p.default !== undefined ?
            color`[${{ param: p.name }}:${{ type }}=${{ input: p.default as string }}]` :
            color`[${{ param: p.name }}:${{ type }}]`
          ) : color`${{ param: p.name }}:${{ type }}`;
      }).join(' ')}`;
    }

    return usage;
  }

  /**
   * Generate list of all help entries
   */
  static generateAppHelpList(confs: ApplicationConfig[] | undefined) {
    const choices = [];
    if (!confs || !confs.length) {
      return color`\nNo applications defined, use ${{ type: '@Application' }} to registry entry points`;
    }
    for (const conf of confs) {
      const lines = [];

      const usage = this.getAppUsage(conf);

      lines.push(color`${{ identifier: conf.name }} ${{ subtitle: conf.description }}`);
      lines.push(color`${{ subsubtitle: 'usage' }}: ${usage}`);
      lines.push(color`${{ subsubtitle: 'file' }}:  ${{ path: conf.filename.replace(`${PathUtil.cwd}/`, '') }}`);

      // eslint-disable-next-line no-control-regex
      const len = lines.reduce((acc, v) => Math.max(acc, v.replace(/\x1b\[\d+m/g, '').length), 0);
      lines.splice(1, 0, '-'.repeat(len));

      choices.push(lines.join('\n     '));
    }
    return choices.map(x => `   ● ${x}`).join('\n\n');
  }
}