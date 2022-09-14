import { Util } from '@travetto/base';

import { ContentType } from '../types';

/**
 * Utils for checking mime patterns
 */
export class MimeUtil {

  static #convert(rule: string): RegExp {
    const core = (rule.endsWith('/*') || !rule.includes('/')) ?
      `${rule.replace(/[/].*$/, '')}\/.*` : rule;
    return new RegExp(`^${core}$`);
  }

  static parse(mimeType?: string): ContentType | undefined {
    if (mimeType) {
      const [full, ...params] = mimeType.split(/\s*;\s*/);
      const [type, subtype] = full.split('/');
      const parameters = Object.fromEntries(params.map(v => v.split('=')).map(([k, v]) => [k.toLowerCase(), v]));
      return { type, subtype, full, parameters };
    }
  }

  /**
   * Build matcher
   */
  static matcher(rules: string[] | string = []): (contentType: string) => boolean {
    return Util.allowDenyMatcher<RegExp, [string]>(
      rules,
      this.#convert.bind(this),
      (regex, mime) => regex.test(mime),
      k => k
    );
  }
}