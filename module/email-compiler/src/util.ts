import path from 'node:path';
import type { CompileResult, Options } from 'sass';

import type { EmailCompiled, EmailTemplateModule, EmailTemplateResource } from '@travetto/email';
import { ImageUtil } from '@travetto/image';
import { BinaryUtil, EncodeUtil, RuntimeIndex, type BinaryArray } from '@travetto/runtime';

type Tokenized = {
  text: string;
  tokens: Map<string, string>;
  finalize: (onToken: (token: string) => string) => string;
};

const SUPPORT_SOURCE = /(?:support|src)\//;

const HTML_CSS_IMAGE_URLS = [
  /(?<prefix><img[^>]src=\s{0,10}["'])(?<source>[^"{}]{1,1000})/g,
  /(?<prefix>background(?:-image)?:\s{0,10}url[(]['"]?)(?<source>[^"'){}]{1,1000})/g
];

const EXT = /[.]email[.]tsx$/;

/**
 * Email compile tools
 */
export class EmailCompileUtil {

  /**
   * Is file a template?
   */
  static isTemplateFile(file: string): boolean {
    return EXT.test(file) && RuntimeIndex.findModuleForArbitraryFile(file) !== undefined;
  }

  /**
   * Generate singular output path given a file
   */
  static buildOutputPath(file: string, suffix: string, prefix?: string): string {
    const location = (SUPPORT_SOURCE.test(file) ? file.split(SUPPORT_SOURCE)[1] : file).replace(EXT, suffix);
    return prefix ? path.join(prefix, location) : location;
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
      for (const { [0]: all, groups: { prefix, source } = { prefix: '', source: '' } } of text.matchAll(pattern)) {
        if (source.includes('://')) { // No urls
          continue;
        }
        const token = `@@${id += 1}@@`;
        tokens.set(token, source);
        text = text.replace(all, `${prefix}${token}`);
      }
    }
    const finalize = (onToken: (token: string) => string): string => text.replace(/@@[^@]{1,100}@@/g, token => onToken(token));

    return { text, tokens, finalize };
  }

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(input: { data: string } | { file: string }, options: EmailTemplateResource): Promise<string> {
    const { initAsyncCompiler } = await import('sass');
    const compiler = await initAsyncCompiler();
    const compilerOptions: Options<'async'> = {
      sourceMap: false,
      quietDeps: true,
      loadPaths: options.loader.searchPaths.slice(0),
    };

    let result: CompileResult;
    if ('data' in input) {
      result = await compiler.compileStringAsync(input.data, compilerOptions);
    } else {
      result = await compiler.compileAsync(input.file, compilerOptions);
    }
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
  static async inlineImages(html: string, options: EmailTemplateResource): Promise<string> {
    const { tokens, finalize } = await this.tokenizeResources(html, HTML_CSS_IMAGE_URLS);
    const pendingImages = [...tokens.entries()].map(async ([token, source]) => {
      const format = path.extname(source).substring(1);

      let bytes: BinaryArray;
      if (ImageUtil.isKnownExtension(format)) {
        const stream = await options.loader.readStream(source);
        const converted = await ImageUtil.convert(stream, { optimize: true, format });
        bytes = await BinaryUtil.toBinaryArray(converted);
      } else {
        bytes = await options.loader.read(source, true);
      }
      return [token, `data:image/${format};base64,${EncodeUtil.toBase64String(bytes)}`] as const;
    });

    const imageMap = new Map(await Promise.all(pendingImages));
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
        (all, property, color, rest) => `${property}${color}${rest} bgcolor="${color}">`) // Inline bg-color
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
  static async applyStyles(html: string, options: EmailTemplateResource): Promise<string> {
    const styles = [
      options.globalStyles ?? '',
      await options.loader.read('/email/main.scss').catch(() => '')
    ]
      .filter(line => !!line)
      .join('\n');

    if (styles.length) {
      const compiled = await this.compileSass({ data: styles }, options);

      // Remove all unused styles
      const finalStyles = await this.pruneCss(html, compiled);

      // Apply styles
      html = await this.inlineCss(html, finalStyles);
    }

    return html;
  }

  static async compile(input: EmailTemplateModule): Promise<EmailCompiled> {
    const subject = await this.simplifiedText(await input.subject());
    const text = await this.simplifiedText(await input.text());

    let html = await input.html();

    if (input.inlineStyle !== false) {
      html = await this.applyStyles(html, input);
    }

    // Fix up html edge cases
    html = this.handleHtmlEdgeCases(html);

    if (input.inlineImages !== false) {
      html = await this.inlineImages(html, input);
    }

    return { html, subject, text };
  }
}