import * as fs from 'fs/promises';
import * as util from 'util';

import { path } from '@travetto/boot';
import { ImageConverter } from '@travetto/image';
import { StreamUtil } from '@travetto/base';
import type { MailTemplateEngine } from '@travetto/email';
import { DependencyRegistry } from '@travetto/di';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';

import { Inky } from './inky';
import { MarkdownUtil } from './markdown';
import { EmailTemplateResource } from './resource';

export type Compilation = { html: string, text: string, subject: string };

/**
 * Utilities for templating
 */
export class EmailTemplateCompiler {

  static HTML_CSS_IMAGE_URLS = [
    /(?<pre><img[^>]src=\s*["'])(?<src>[^"]+)/g,
    /(?<pre>background(?:-image)?:\s*url[(]['"]?)(?<src>[^"')]+)/g
  ];

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(file: string, roots: string[]): Promise<string> {
    const sass = await import('sass');
    const result = await util.promisify(sass.render)({
      file,
      sourceMap: false,
      includePaths: roots
    });
    return result!.css.toString();
  }

  resources: EmailTemplateResource;

  constructor(resources: EmailTemplateResource) {
    this.resources = resources;
  }

  /**
   * Inline image sources
   */
  async inlineImageSource(html: string, baseRel: string): Promise<string> {
    const { tokens, finalize } = await this.resources.tokenizeResources(html, EmailTemplateCompiler.HTML_CSS_IMAGE_URLS, baseRel);
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

  async inlineCss(html: string, css: string): Promise<string> {
    // Inline css
    const inlineCss = await import('inline-css');
    html = (await inlineCss(html, {
      url: 'https://app.dev',
      preserveMediaQueries: true,
      removeStyleTags: true,
      removeLinkTags: true,
      applyStyleTags: true,
      extraCss: css
    }));
    return html;
  }

  /**
   * Compile all
   */
  async compileAll(persist = false): Promise<Compilation[]> {
    const keys = await this.resources.findAllTemplates();
    return Promise.all(keys.map(({ path: tpl }) => this.compile(tpl, persist)));
  }

  /**
   * Compile template
   */
  async compile(rel: string, persist = false): Promise<Compilation> {
    let tpl = await this.resources.read(rel);

    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);

    // Wrap with body
    tpl = (await this.resources.read('/wrapper.html')).replace('<!-- BODY -->', tpl);

    // Resolve mustache partials
    tpl = await engine.resolveNested(tpl);

    // Transform inky markup
    let html = Inky.render(tpl);

    // Get Subject
    const [, subject] = html.match(/<title>(.*?)<\/title>/) ?? [];

    // Apply styles
    html = await this.inlineCss(html,
      await EmailTemplateCompiler.compileSass(
        (await this.resources.describe('main.scss')).path,
        [
          // TODO: need to look at require paths
          path.resolve('node_modules/foundation-emails/scss'),
          ...this.resources.getAllPaths()
        ]
      )
    );

    // Inline Images
    html = await this.inlineImageSource(html, path.dirname(rel));

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    // Write to disk, if desired
    if (persist) {
      const outs = this.resources.getOutputs((await this.resources.describe(rel)).path);
      await Promise.all([
        [outs.text, text],
        [outs.html, html],
        [outs.subject, subject]
      ].map(([file, content]) =>
        content ?
          fs.writeFile(file, content, { encoding: 'utf8' }) :
          fs.unlink(file).catch(() => { }) // Remove file if data not provided
      ));
    }

    return { html, text, subject };
  }
}