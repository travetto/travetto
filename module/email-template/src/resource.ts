import { FileQueryProvider } from '@travetto/base';

/**
 * Resource management for email templating
 */
export class EmailTemplateResource extends FileQueryProvider {
  static PATH_PREFIX = /.*\/resources\/email\//;
  static EXT = /[.]email[.]html$/;
  ext = EmailTemplateResource.EXT;

  constructor(paths: string[] = ['@travetto/email-template']) {
    super({ paths, includeCommon: true, moduleFolder: 'support/resources/email' });
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
  async findAllTemplates(): Promise<{ rel: string, key: string }[]> {
    const all: { rel: string, key: string }[] = [];
    for await (const entry of this.query(f => this.ext.test(f))) {
      const { path } = await this.describe(entry);
      all.push({
        rel: path.replace(EmailTemplateResource.PATH_PREFIX, ''),
        key: entry.replace(this.ext, '')
      });
    }
    return all.sort((a, b) => a.rel.localeCompare(b.rel));
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
    text: string;
    tokens: Map<string, string>;
    finalize: (onToken: (token: string) => string) => string;
  }> {
    let id = 0;
    const tokens = new Map();
    for (const pattern of patterns) {
      for (const { [0]: all, groups: { pre, src } = { pre: '', src: '' } } of text.matchAll(pattern)) {
        if (src.includes('://')) { // No urls
          continue;
        }
        const relative = `${baseRel}/${src}`;
        await this.describe(relative);
        const token = `@@${id += 1}@@`;
        tokens.set(token, relative);
        text = text.replace(all, `${pre}${token}`);
      }
    }
    const finalize = (onToken: (token: string) => string): string => text.replace(/@@[^@]+@@/g, t => onToken(t));

    return { text, tokens, finalize };
  }
}
