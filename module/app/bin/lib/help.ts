import { color } from '@travetto/cli/src/color';
import { RunUtil } from './run';
import { CachedAppConfig } from '../../src/types';

export class HelpUtil {

  /**
   * Convert single ApplicationConfig into a stylized entry
   */
  static getAppUsage(app: CachedAppConfig) {
    let usage = app.name;

    if (app.params) {
      usage = color`${{ identifier: usage }} ${app.params.map(p => {
        const type = RunUtil.getParamType(p);

        return p.optional ?
          (p.def !== undefined ?
            color`[${{ param: p.name }}:${{ type }}=${{ input: p.def }}]` :
            color`[${{ param: p.name }}:${{ type }}]`
          ) : color`${{ param: p.name }}:${{ type }}`;
      }).join(' ')}`;
    }

    return usage;
  }

  /**
   * Generate list of all help entries
   */
  static generateAppHelpList(confs: CachedAppConfig[] | undefined) {
    const choices = [];
    if (!confs || !confs.length) {
      return color`\nNo applications defined, use ${{ type: '@Application' }} to registry entry points`;
    }
    for (const conf of confs) {
      const lines = [];

      const root = conf.appRoot !== '.' ? color`[${{ subtitle: conf.appRoot }}] ` : '';
      const usage = this.getAppUsage(conf);

      const features = [];
      let featureStr = '';
      if (conf.watchable) {
        features.push('{watch}');
      }
      if (features.length) {
        featureStr = ` | ${features.join(' ')}`;
      }

      lines.push(color`${root}${{ identifier: conf.name }}${featureStr}`);
      if (conf.description) {
        lines.push(color`desc:  ${{ description: conf.description }}`);
      }
      lines.push(`usage: ${usage}`);

      // eslint-disable-next-line no-control-regex
      const len = lines.reduce((acc, v) => Math.max(acc, v.replace(/\x1b\[\d+m/g, '').length), 0);
      lines.splice(1, 0, '-'.repeat(len));

      choices.push(lines.join('\n     '));
    }
    return choices.map(x => `   ● ${x}`).join('\n\n');
  }

}