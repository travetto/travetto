import { FileQueryProvider } from '@travetto/base';
import { MessageCompilationSource, MessageCompiled } from '@travetto/email';
import { RootIndex, path } from '@travetto/manifest';

/**
 * Resource management for email templating
 */
export class EmailCompilerResource extends FileQueryProvider {
  static PATH_PREFIX = /.*\/resources\//;
  static EXT = /[.]email[.][jt]sx$/;

  get ext(): RegExp {
    return EmailCompilerResource.EXT;
  }

  constructor(paths: string[] = ['@travetto/email-compiler#support/resources']) {
    super({ paths, includeCommon: true });
  }

  buildOutputPath(file: string, suffix: string, prefix?: string): string {
    let res = file.replace(/.*(support|src)\//, '').replace(this.ext, suffix);
    if (prefix) {
      res = path.join(prefix, res);
    }
    return res;
  }

  /**
   * Get the different parts from the file name
   * @returns
   */
  getOutputs(file: string, prefix?: string): MessageCompiled {
    return {
      html: this.buildOutputPath(file, '.compiled.html', prefix),
      subject: this.buildOutputPath(file, '.compiled.subject', prefix),
      text: this.buildOutputPath(file, '.compiled.text', prefix),
    };
  }

  /**
   * Is this a valid template file?
   */
  isTemplateFile(file: string): boolean {
    return this.ext.test(file);
  }

  /**
   * Get the sending email key from a template file
   * @param file
   */
  async templateFileToKey(file: string): Promise<string> {
    return this.buildOutputPath(file, '');
  }

  async loadTemplate(imp: string): Promise<MessageCompilationSource> {
    const entry = RootIndex.getEntry(imp) ?? RootIndex.getFromImport(imp);
    if (!entry) {
      throw new Error();
    }
    const root = (await import(entry.outputFile)).default;
    return { ...root, file: entry.sourceFile };
  }

  /**
   * Grab list of all available templates
   */
  async findAllTemplates(): Promise<MessageCompilationSource[]> {
    const items = RootIndex.findSupport({
      filter: (f) => this.ext.test(f)
    });
    const out: Promise<MessageCompilationSource>[] = [];
    for (const item of items) {
      out.push(this.loadTemplate(item.import));
    }
    return Promise.all(out);
  }


  /**
   * Run through text and match/resolve resource urls, producing tokens
   *
   * @param text
   * @param patterns
   * @returns
   */
  async tokenizeResources(
    text: string,
    patterns: RegExp[]
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
        await this.describe(src);
        const token = `@@${id += 1}@@`;
        tokens.set(token, src);
        text = text.replace(all, `${pre}${token}`);
      }
    }
    const finalize = (onToken: (token: string) => string): string => text.replace(/@@[^@]+@@/g, t => onToken(t));

    return { text, tokens, finalize };
  }
}
