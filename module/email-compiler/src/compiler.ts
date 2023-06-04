import fs from 'fs/promises';
import util from 'util';
import { decode as decodeEntities } from 'html-entities';

import { ImageConverter } from '@travetto/image';
import { RootIndex, path } from '@travetto/manifest';
import { StreamUtil } from '@travetto/base';
import { MessageCompilationSource, MessageCompiled } from '@travetto/email';

import { EmailCompilerResource } from './resource';

/**
 * Utilities for templating
 */
export class EmailCompiler {

  static HTML_CSS_IMAGE_URLS = [
    /(?<pre><img[^>]src=\s*["'])(?<src>[^"]+)/g,
    /(?<pre>background(?:-image)?:\s*url[(]['"]?)(?<src>[^"')]+)/g
  ];

  static async readText(text: Promise<string> | string): Promise<string> {
    return decodeEntities((await text).replace(/&#xA0;/g, ' '));
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

  resources: EmailCompilerResource;

  constructor(resources: EmailCompilerResource) {
    this.resources = resources;
  }

  /**
   * Inline image sources
   */
  async inlineImageSource(html: string): Promise<string> {
    const { tokens, finalize } = await this.resources.tokenizeResources(html, EmailCompiler.HTML_CSS_IMAGE_URLS);
    const pendingImages: Promise<[token: string, content: string]>[] = [];

    for (const [token, src] of tokens) {
      const ext = path.extname(src).replace(/^[.]/, '');
      const stream = await this.resources.readStream(src);

      switch (ext) {
        case 'jpg':
        case 'jpeg':
        case 'png': {
          pendingImages.push(
            ImageConverter.optimize(ext === 'png' ? 'png' : 'jpeg', stream)
              .then(img => StreamUtil.streamToBuffer(img))
              .then(data => [token, `data:image/${ext};base64,${data.toString('base64')}`])
          );
          break;
        }
        default: {
          pendingImages.push(
            StreamUtil.streamToBuffer(stream)
              .then(data => [token, `data:image/${ext};base64,${data.toString('base64')}`])
          );
        }
      }
    }

    const imageMap = new Map(await Promise.all(pendingImages));

    return finalize(token => imageMap.get(token)!);
  }

  async pruneCss(html: string, css: string): Promise<string> {
    const { PurgeCSS } = await import('purgecss');
    const purge = new PurgeCSS();
    const result = await purge.purge({
      content: [{ raw: html, extension: 'html' }],
      css: [{ raw: css }],
    });
    return result[0].css;
  }

  async inlineCss(html: string, css: string): Promise<string> {
    // Inline css
    const { default: inlineCss } = await import('inline-css');
    html = html.replace('</head>', `<style>${css}</style></head>`);
    // Style needs to be in head to preserve media queries
    html = (await inlineCss(html, {
      url: 'https://app.dev',
      preserveMediaQueries: true,
      removeStyleTags: true,
      removeLinkTags: true,
      applyStyleTags: true,
    }));
    return html;
  }

  /**
   * Compile all
   */
  async compileAll(persist = false): Promise<MessageCompiled[]> {
    const keys = await this.resources.findAllTemplates();
    return Promise.all(keys.map(src => this.compile(src, persist)));
  }

  /**
   * Compile template
   */
  async compile(src: string | MessageCompilationSource, persist = false): Promise<MessageCompiled> {
    if (typeof src === 'string') {
      src = await this.resources.loadTemplate(src);
    }

    const subject = await EmailCompiler.readText(src.subject());
    const text = await EmailCompiler.readText(src.text());

    let html = (await src.html())
      .replace(/<(meta|img|link|hr|br)[^>]*>/g, a => a.replace('>', '/>')) // Fix self closing
      .replace(/&apos;/g, '&#39;'); // Fix apostrophes, as outlook hates them

    if (src.inlineStyles !== false) {
      const styles: string[] = [];

      if (src.styles?.global) {
        styles.push(src.styles.global);
      }

      const main = await this.resources.read('/email/main.scss').then(d => d, () => '');
      if (main) {
        styles.push(main);
      }

      if (styles.length) {
        const compiled = await EmailCompiler.compileSass(
          { data: styles.join('\n') },
          [...src.styles?.search ?? [], ...this.resources.getAllPaths()]);

        // Remove all unused styles
        const finalStyles = await this.pruneCss(html, compiled);

        // Apply styles
        html = await this.inlineCss(html, finalStyles);
      }
    }

    // Fix up style behaviors
    html = html
      .replace(/(background(?:-color)?:\s*)([#0-9a-f]{6,8})([^>.#,]+)>/ig,
        (all, p, col, rest) => `${p}${col}${rest} bgcolor="${col}">`) // Inline bg-color
      .replace(/<([^>]+vertical-align:\s*(top|bottom|middle)[^>]+)>/g,
        (a, tag, valign) => tag.indexOf('valign') ? `<${tag}>` : `<${tag} valign="${valign}">`) // Vertically align if it has the style
      .replace(/<(table[^>]+expand[^>]+width:\s*)(100%\s+!important)([^>]+)>/g,
        (a, left, size, right) => `<${left}100%${right}>`); // Drop important as a fix for outlook

    if (src.inlineImages !== false) {
      // Inline Images
      html = await this.inlineImageSource(html);
    }

    // Write to disk, if desired
    if (persist) {
      const outs = this.resources.getOutputs(src.file!, path.join(RootIndex.mainModule.sourcePath, 'resources'));
      await Promise.all([
        [outs.text, text],
        [outs.html, html],
        [outs.subject, subject]
      ].map(async ([file, content]) => {
        if (content) {
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(file, content, { encoding: 'utf8' });
        } else {
          await fs.unlink(file).catch(() => { }); // Remove file if data not provided
        }
      }));
    }

    return { html, text, subject };
  }
}