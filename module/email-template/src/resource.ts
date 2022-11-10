import * as path from '@travetto/path';
import { Env } from '@travetto/base';
import { EmailResource } from '@travetto/email';

/**
 * Resource management for email templating
 */
export class EmailTemplateResource extends EmailResource {
  ext = /[.]email[.]html$/;

  moduleFolder = 'support/resources/email';

  constructor(paths: string[] = ['@travetto/email-template']) {
    super([
      ...paths,
      ...Env.getList('TRV_RESOURCES')
    ]);
  }

  /**
   * Is this a valid template file?
   */
  isTemplateFile(file: string): boolean {
    return this.ext.test(file);
  }

  /**
   * Grab list of all available templates
   */
  async findAllTemplates(): Promise<{ path: string, key: string }[]> {
    return Promise.all((await this.query(f => this.ext.test(f)))
      .sort()
      .map(async pth => ({
        path: (await this.describe(pth)).path,
        key: pth.replace(this.ext, '')
      })));
  }

  /** 
   * Get the different parts from the file name
   * @param rel 
   * @returns 
   */
  getOutputs(rel: string): { html: string, text: string, subject: string } {
    return {
      html: rel.replace(this.ext, '.compiled.html'),
      subject: rel.replace(this.ext, '.compiled.subject'),
      text: rel.replace(this.ext, '.compiled.text'),
    };
  }

  /**
   * Run through text and match/resolve resource urls, producing tokens 
   * 
   * @param text 
   * @param patterns 
   * @param baseRel 
   * @returns 
   */
  async tokenizeResources(
    text: string,
    patterns: RegExp[],
    baseRel: string
  ): Promise<{
    text: string,
    tokens: Map<string, string>,
    finalize: (onToken: (token: string) => string) => string,
  }> {
    let id = 0;
    const tokens = new Map();
    for (const pattern of patterns) {
      for (let { [0]: all, groups: { pre, src } = { pre: '', src: '' } } of text.matchAll(pattern)) {
        if (src.includes('://')) { // No urls
          continue;
        }
        const relative = path.resolve(baseRel, src);
        await this.describe(relative);
        const token = `@@${id += 1}@@`;
        tokens.set(token, relative);
        text = text.replace(all, `${pre}${token}`);
      }
    }
    const finalize = (onToken: (token: string) => string) => text.replace(/@@[^@]+@@/g, t => onToken(t));

    return { text, tokens, finalize };
  }
}
