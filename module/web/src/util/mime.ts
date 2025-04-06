import { Util } from '@travetto/runtime';

export type MimeType = { type: string, subtype: string, full: string, parameters: Record<string, string> };

/**
 * Utils for checking mime patterns
 */
export class MimeUtil {

  static #convert(rule: string): RegExp {
    const core = (rule.endsWith('/*') || !rule.includes('/')) ?
      `${rule.replace(/[/].{0,20}$/, '')}\/.*` : rule;
    return new RegExp(`^${core}[ ]{0,10}(;|$)`);
  }

  static parse(mimeType?: string): MimeType | undefined {
    if (mimeType) {
      const [full, ...params] = mimeType.split(/;/).map(x => x.trim());
      const [type, subtype] = full.split('/');
      const parameters = Object.fromEntries(params.map(v => v.split('=')).map(([k, v]) => [k.toLowerCase(), v]));
      return { type, subtype, full, parameters };
    }
  }

  /**
   * Build matcher
   */
  static matcher(rules: string[] | string = []): (contentType: string) => boolean {
    return Util.allowDeny<RegExp, [string]>(
      rules,
      this.#convert.bind(this),
      (regex, mime) => regex.test(mime),
      k => k
    );
  }
}