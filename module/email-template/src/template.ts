import * as fs from 'fs';
import * as util from 'util';
import * as inlineCss from 'inline-css'; // @line-if inline-css

import { AppCache, FsUtil, EnvUtil } from '@travetto/boot';
import { ResourceManager } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';
import { Injectable, Inject } from '@travetto/di';
import { ImageUtil } from '@travetto/image';
import { MailTemplateEngine } from '@travetto/email';

import { TemplateUtil } from './util';
import { MailTemplateConfig } from './config';
import { Inky } from './inky';
import { MarkdownUtil } from './markdown';

const fsReadFile = util.promisify(fs.readFile);

/**
 * Default mail template engine
 */
@Injectable()
export class DefaultMailTemplateEngine extends MailTemplateEngine {

  private cache: Record<string, { html: string, text: string }> = {};

  private defaultTemplateWidth = EnvUtil.getInt('EMAIL_WIDTH', 580);

  @Inject()
  private config: MailTemplateConfig;

  private compiledSass: Promise<string>;
  private templatesLoaded: boolean;
  private templates: Record<string, string> = {};

  /**
   * Get compiled styles
   */
  get compiledStyles(): Promise<string> {
    if (!this.compiledSass) {
      this.compiledSass = (async () => {
        const partial = '/email/app.scss';
        const full = FsUtil.resolveUnix(__dirname, `../resources/${partial}`);

        if (!AppCache.hasEntry(full)) {
          const file = await ResourceManager.find(partial);
          const css = await TemplateUtil.compileSass(file, this.config.scssRoots);
          AppCache.writeEntry(full, css);
          return css;
        } else {
          return AppCache.readEntry(full);
        }
      })();
    }
    return this.compiledSass;
  }

  /**
   * Initialize all templates
   */
  private async initTemplates() {
    if (!this.templatesLoaded) {
      this.templatesLoaded = true;
      for (const f of await ResourceManager.findAllByPattern(/[.]html$/, 'email')) {
        await this.registerTemplate(f, await ResourceManager.read(f));
      }
    }
  }

  /**
   * Register a new template
   */
  registerTemplate(name: string, partial: string | Buffer) {
    console.debug('Registering template', name);
    this.templates[name] = partial.toString();
  }

  /**
   * Fetch image and return as buffer
   */
  async getImage(rel: string) {
    const pth = await ResourceManager.find(rel);
    const out = AppCache.toEntryName(pth);

    if (await FsUtil.exists(out)) {
      const stream = await ImageUtil.optimizePng(pth);
      await SystemUtil.streamToFile(stream, out);
    }

    return fsReadFile(out);
  }

  /**
   * Get wrapper html contents
   */
  get wrapper() {
    return this.templates['email/wrapper.html'];
  }

  /**
   * Compile template
   */
  async compile(tpl: string) {
    // Load wrapper
    tpl = TemplateUtil.wrapWithBody(tpl, this.wrapper);

    // Resolve mustache partials
    tpl = await TemplateUtil.resolveNestedTemplates(tpl, await this.templates);

    let html = Inky.render(tpl);

    // Inline compiled styles
    const css = await this.compiledStyles;
    const styles = [`<style type="text/css">\n${css}\n</style>`];

    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (all) => {
      styles.push(all);
      return '';
    });

    // Macro support
    html = html
      .replace(/<\/head>/, all => `${styles.join('\n')}\n${all}`)
      .replace(/%EMAIL_WIDTH%/g, `${this.defaultTemplateWidth}`);

    // Inline Images
    html = await TemplateUtil.inlineImageSource(html, (k) => this.getImage(k));

    // Inline css
    html = (await inlineCss(html, {
      url: 'https://google.com',
      preserveMediaQueries: true,
      removeStyleTags: true,
      applyStyleTags: true
    }));

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text };
  }

  /**
   * Get compiled template
   */
  async getCompiled(template: string) {
    if (!this.cache[template]) {
      await this.initTemplates();
      this.cache[template] = await this.compile(this.templates[template] || template); // Handle if template is not a name
    }
    return this.cache[template];
  }

  /**
   * Simple interpolation
   */
  async interpolate(text: string, context: Record<string, any> = {}) {
    return TemplateUtil.interpolate(text, context);
  }

  /**
   * Template entire email
   */
  async template(template: string, context: Record<string, any> = {}) {
    const { html, text } = await this.getCompiled(template);

    // Render final template
    return {
      html: TemplateUtil.interpolate(html, context),
      text: TemplateUtil.interpolate(text, context)
    };
  }
}