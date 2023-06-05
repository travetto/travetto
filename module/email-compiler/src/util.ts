import fs from 'fs/promises';
import util from 'util';
import { Readable } from 'stream';

import { ResourceProvider, StreamUtil } from '@travetto/base';
import { MessageCompilationSource, MessageCompilationStyles, MessageCompiled } from '@travetto/email';
import { RootIndex, path } from '@travetto/manifest';
import { ImageConverter } from '@travetto/image';
import { EmailCompilerResource } from './resource';

type Tokenized = {
  text: string;
  tokens: Map<string, string>;
  finalize: (onToken: (token: string) => string) => string;
};

/**
 * Standard email compilation utilities
 */
export class EmailCompilerUtil {

  static #EXT = /[.]email[.]tsx$/;
  static #HTML_CSS_IMAGE_URLS = [
    /(?<pre><img[^>]src=\s*["'])(?<src>[^"]+)/g,
    /(?<pre>background(?:-image)?:\s*url[(]['"]?)(?<src>[^"')]+)/g
  ];

  static isTemplateFile(file: string): boolean {
    return this.#EXT.test(file);
  }

  /**
   * Run through text and match/resolve resource urls, producing tokens
   *
   * @param text
   * @param patterns
   * @returns
   */
  static async tokenizeResources(text: string, patterns: RegExp[]): Promise<Tokenized> {
    let id = 0;
    const tokens = new Map();
    for (const pattern of patterns) {
      for (const { [0]: all, groups: { pre, src } = { pre: '', src: '' } } of text.matchAll(pattern)) {
        if (src.includes('://')) { // No urls
          continue;
        }
        const token = `@@${id += 1}@@`;
        tokens.set(token, src);
        text = text.replace(all, `${pre}${token}`);
      }
    }
    const finalize = (onToken: (token: string) => string): string => text.replace(/@@[^@]+@@/g, t => onToken(t));

    return { text, tokens, finalize };
  }

  /** Load Template */
  static async loadTemplate(imp: string): Promise<MessageCompilationSource> {
    const entry = RootIndex.getEntry(imp) ?? RootIndex.getFromImport(imp);
    if (!entry) {
      throw new Error();
    }
    const root = (await import(entry.outputFile)).default;
    return { ...await root.wrap(), file: entry.sourceFile };
  }

  /**
   * Grab list of all available templates
   */
  static findAllTemplates(): string[] {
    return RootIndex
      .findSupport({ filter: f => this.isTemplateFile(f) })
      .map(x => x.import);
  }

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(src: { data: string } | { file: string }, roots: string[]): Promise<string> {
    const sass = await import('sass');
    const result = await util.promisify(sass.render)({
      ...src,
      sourceMap: false,
      includePaths: roots
    });
    return result!.css.toString();
  }

  /**
   * Prunes unused css given html document
   */
  static async pruneCss(html: string, css: string): Promise<string> {
    const { PurgeCSS } = await import('purgecss');
    const purge = new PurgeCSS();
    const [result] = await purge.purge({
      content: [{ raw: html, extension: 'html' }],
      css: [{ raw: css }],
    });
    return result.css;
  }

  /**
   * Moves CSS inline into html output, minus media queries
   */
  static async inlineCss(html: string, css: string): Promise<string> {
    // Inline css
    const { default: inlineCss } = await import('inline-css');
    return inlineCss(
      // Style needs to be in head to preserve media queries
      html.replace('</head>', `<style>${css}</style></head>`),
      {
        url: 'https://app.dev',
        preserveMediaQueries: true,
        removeStyleTags: true,
        removeLinkTags: true,
        applyStyleTags: true,
      });
  }

  /**
   * Simplifies text by decoding all entities
   *
   * @param text
   */
  static async simplifiedText(text: string): Promise<string> {
    const { decode: decodeEntities } = await import('html-entities');
    return decodeEntities(text.replace(/&#xA0;/g, ' '));
  }

  /**
   * Inline image sources
   */
  static async inlineImages(html: string, resources: ResourceProvider): Promise<string> {
    const { tokens, finalize } = await this.tokenizeResources(html, this.#HTML_CSS_IMAGE_URLS);
    const pendingImages: [token: string, ext: string, stream: Readable | Promise<Readable>][] = [];

    for (const [token, src] of tokens) {
      const ext = path.extname(src);
      const stream = await resources.readStream(src);
      pendingImages.push([token, ext, /^[.](jpe?g|png)$/.test(ext) ? ImageConverter.optimize(ext === '.png' ? 'png' : 'jpeg', stream) : stream]);
    }

    const imageMap = new Map(await Promise.all(pendingImages.map(async ([token, ext, stream]) => {
      const data = await StreamUtil.streamToBuffer(await stream);
      return [token, `data:image/${ext};base64,${data.toString('base64')}`] as const;
    })));

    return finalize(token => imageMap.get(token)!);
  }

  /**
   * Handle various edge cases
   */
  static handleHtmlEdgeCases(html: string): string {
    return html
      .replace(/<(meta|img|link|hr|br)[^>]*>/g, a => a.replace('>', '/>')) // Fix self closing
      .replace(/&apos;/g, '&#39;') // Fix apostrophes, as outlook hates them
      .replace(/(background(?:-color)?:\s*)([#0-9a-f]{6,8})([^>.#,]+)>/ig,
        (all, p, col, rest) => `${p}${col}${rest} bgcolor="${col}">`) // Inline bg-color
      .replace(/<([^>]+vertical-align:\s*(top|bottom|middle)[^>]+)>/g,
        (a, tag, valign) => tag.indexOf('valign') ? `<${tag}>` : `<${tag} valign="${valign}">`) // Vertically align if it has the style
      .replace(/<(table[^>]+expand[^>]+width:\s*)(100%\s+!important)([^>]+)>/g,
        (a, left, size, right) => `<${left}100%${right}>`); // Drop important as a fix for outlook
  }

  /**
   * Generate singular output path given a file
   */
  static buildOutputPath(file: string, suffix: string, prefix?: string): string {
    let res = file.replace(/.*(support|src)\//, '').replace(this.#EXT, suffix);
    if (prefix) {
      res = path.join(prefix, res);
    }
    return res;
  }

  /**
   * Get the different parts from the file name
   */
  static getOutputs(file: string, prefix?: string): MessageCompiled {
    return {
      html: this.buildOutputPath(file, '.compiled.html', prefix),
      subject: this.buildOutputPath(file, '.compiled.subject', prefix),
      text: this.buildOutputPath(file, '.compiled.text', prefix),
    };
  }

  /**
   * Get the sending email key from a template file
   */
  static async templateFileToKey(file: string): Promise<string> {
    return this.buildOutputPath(file, '');
  }

  /**
   * Write template to file
   */
  static async writeTemplate(file: string, { text, html, subject }: MessageCompiled): Promise<void> {
    // Write to disk, if desired
    const entry = RootIndex.getEntry(file)!;
    const mod = RootIndex.getModule(entry.module)!;
    const outs = this.getOutputs(file, path.join(mod.sourcePath, 'resources'));

    await Promise.all([
      [outs.text, text],
      [outs.html, html],
      [outs.subject, subject]
    ].map(async ([output, content]) => {
      if (content) {
        await fs.mkdir(path.dirname(output), { recursive: true });
        await fs.writeFile(output, content, { encoding: 'utf8' });
      } else {
        await fs.unlink(output).catch(() => { }); // Remove file if data not provided
      }
    }));
  }

  /**
   * Apply styles into a given html document
   */
  static async applyStyles(html: string, opts: MessageCompilationStyles, resource: EmailCompilerResource): Promise<string> {
    const styles: string[] = [];

    if (opts.global) {
      styles.push(opts.global);
    }

    const main = await resource.read('/email/main.scss').then(d => d, () => '');
    if (main) {
      styles.push(main);
    }

    if (styles.length) {
      const compiled = await this.compileSass(
        { data: styles.join('\n') },
        [...opts.search ?? [], ...resource.getAllPaths()]);

      // Remove all unused styles
      const finalStyles = await this.pruneCss(html, compiled);

      // Apply styles
      html = await this.inlineCss(html, finalStyles);
    }

    return html;
  }

  /**
   * Compile a file given a resource provider
   */
  static async compile(file: string, resource: EmailCompilerResource, persist: boolean = false): Promise<MessageCompiled> {
    const src = await this.loadTemplate(file);
    const subject = await this.simplifiedText(await src.subject());
    const text = await this.simplifiedText(await src.text());

    let html = await src.html();

    if (src.styles?.inline !== false) {
      html = await this.applyStyles(html, src.styles ?? {}, resource);
    }

    // Fix up html edge cases
    html = this.handleHtmlEdgeCases(html);

    if (src.images?.inline !== false) {
      html = await this.inlineImages(html, resource);
    }

    if (persist) {
      await this.writeTemplate(file, { html, text, subject });
    }

    return { html, text, subject };
  }
}