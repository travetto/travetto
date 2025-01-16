import util from 'node:util';
import { buffer as toBuffer } from 'node:stream/consumers';
import path from 'node:path';

import { EmailCompiled, EmailTemplateModule, EmailTemplateResource } from '@travetto/email';
import { ImageUtil } from '@travetto/image';

type Tokenized = {
  text: string;
  tokens: Map<string, string>;
  finalize: (onToken: (token: string) => string) => string;
};

const SUPPORT_SRC = /(?:support|src)\//;

/**
 * Email compile tools
 */
export class EmailCompileUtil {
  static #HTML_CSS_IMAGE_URLS = [
    /(?<pre><img[^>]src=\s{0,10}["'])(?<src>[^"{}]{1,1000})/g,
    /(?<pre>background(?:-image)?:\s{0,10}url[(]['"]?)(?<src>[^"'){}]{1,1000})/g
  ];

  static #EXT = /[.]email[.]tsx$/;

  /**
   * Is file a template?
   */
  static isTemplateFile(file: string): boolean {
    return this.#EXT.test(file);
  }

  /**
   * Generate singular output path given a file
   */
  static buildOutputPath(file: string, suffix: string, prefix?: string): string {
    const res = (SUPPORT_SRC.test(file) ? file.split(SUPPORT_SRC)[1] : file).replace(this.#EXT, suffix);
    return prefix ? path.join(prefix, res) : res;
  }

  /**
   * Get the different parts from the file name
   */
  static getOutputs(file: string, prefix?: string): EmailCompiled {
    return {
      html: this.buildOutputPath(file, '.compiled.html', prefix),
      subject: this.buildOutputPath(file, '.compiled.subject', prefix),
      text: this.buildOutputPath(file, '.compiled.text', prefix),
    };
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
    const finalize = (onToken: (token: string) => string): string => text.replace(/@@[^@]{1,100}@@/g, t => onToken(t));

    return { text, tokens, finalize };
  }

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(src: { data: string } | { file: string }, opts: EmailTemplateResource): Promise<string> {
    const sass = await import('sass');
    const result = await util.promisify(sass.render)({
      ...src,
      sourceMap: false,
      includePaths: opts.loader.searchPaths.slice(0)
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
    const { decode } = await import('html-entities');
    return decode(text.replace(/&#xA0;/g, ' '));
  }

  /**
   * Inline image sources
   */
  static async inlineImages(html: string, opts: EmailTemplateResource): Promise<string> {
    const { tokens, finalize } = await this.tokenizeResources(html, this.#HTML_CSS_IMAGE_URLS);
    const pendingImages: [token: string, ext: string, stream: Buffer | Promise<Buffer>][] = [];

    for (const [token, src] of tokens) {
      const ext = path.extname(src);
      if (/^[.](jpe?g|png)$/.test(ext)) {
        const output = await ImageUtil.convert(
          await opts.loader.readStream(src),
          { format: ext === '.png' ? 'png' : 'jpeg' }
        );
        const buffer = await toBuffer(output);
        pendingImages.push([token, ext, buffer]);
      } else {
        pendingImages.push([token, ext, opts.loader.read(src, true)]);
      }
    }

    const imageMap = new Map(await Promise.all(pendingImages.map(async ([token, ext, data]) =>
      [token, `data:image/${ext.replace('.', '')};base64,${data.toString('base64')}`] as const
    )));

    return finalize(token => imageMap.get(token)!);
  }

  /**
   * Handle various edge cases
   */
  static handleHtmlEdgeCases(html: string): string {
    return html
      .replace(/\n{3,100}/msg, '\n\n')
      .replace(/<(meta|img|link|hr|br)[^>]{0,200}>/g, a => a.replace(/>/g, '/>')) // Fix self closing
      .replace(/&apos;/g, '&#39;') // Fix apostrophes, as outlook hates them
      .replace(/(background(?:-color)?:\s*)([#0-9a-f]{6,8})([^>.#,]+)>/ig,
        (all, p, col, rest) => `${p}${col}${rest} bgcolor="${col}">`) // Inline bg-color
      .replace(/<([^>]+vertical-align:\s*(top|bottom|middle)[^>]+)>/g,
        (a, tag, valign) => tag.indexOf('valign') ? `<${tag}>` : `<${tag} valign="${valign}">`) // Vertically align if it has the style
      .replace(/<(table[^>]+expand[^>]+width:\s*)(100%\s+!important)([^>]+)>/g,
        (a, left, size, right) => `<${left}100%${right}>`) // Drop important as a fix for outlook
      .trim()
      .concat('\n');
  }

  /**
   * Apply styles into a given html document
   */
  static async applyStyles(html: string, opts: EmailTemplateResource): Promise<string> {
    const styles = [
      opts.globalStyles ?? '',
      await opts.loader.read('/email/main.scss').catch(() => '')
    ].filter(x => !!x).join('\n');

    if (styles.length) {
      const compiled = await this.compileSass({ data: styles }, opts);

      // Remove all unused styles
      const finalStyles = await this.pruneCss(html, compiled);

      // Apply styles
      html = await this.inlineCss(html, finalStyles);
    }

    return html;
  }

  static async compile(src: EmailTemplateModule): Promise<EmailCompiled> {
    const subject = await this.simplifiedText(await src.subject());
    const text = await this.simplifiedText(await src.text());

    let html = await src.html();

    if (src.inlineStyle !== false) {
      html = await this.applyStyles(html, src);
    }

    // Fix up html edge cases
    html = this.handleHtmlEdgeCases(html);

    if (src.inlineImages !== false) {
      html = await this.inlineImages(html, src);
    }

    return { html, subject, text };
  }
}