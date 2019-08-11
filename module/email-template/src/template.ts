import * as fs from 'fs';
import * as util from 'util';

import { AppCache, EnvUtil, FsUtil } from '@travetto/boot';
import { ResourceManager, SystemUtil } from '@travetto/base';
import { Injectable, Inject } from '@travetto/di';
import { ImageUtil } from '@travetto/image';
import { MailTemplateEngine, MailTemplateContext } from '@travetto/email';

import { TemplateUtil } from './util';
import { MailTemplateConfig } from './config';
import { Inky } from './inky';
import { MarkdownUtil } from './markdown';

const fsStat = util.promisify(fs.stat);
const fsReadFile = util.promisify(fs.readFile);

@Injectable()
export class DefaultMailTemplateEngine extends MailTemplateEngine {

  private cache: Record<string, { html: string, text: string }> = {};

  private defaultTemplateWidth = EnvUtil.getInt('EMAIL_WIDTH', 580);

  @Inject()
  private config: MailTemplateConfig;

  private compiledSass: Promise<string>;
  private templatesLoaded: boolean;
  private templates: Record<string, string> = {};

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

  private async initTemplates() {
    if (!this.templatesLoaded) {
      this.templatesLoaded = true;
      for (const f of await ResourceManager.findAllByExtension('.html', 'email')) {
        await this.registerTemplate(f, await ResourceManager.read(f));
      }
    }
  }

  registerTemplate(name: string, partial: string | Buffer) {
    console.debug('Registering template', name);
    this.templates[name] = partial.toString();
  }

  async getImage(rel: string) {
    const pth = await ResourceManager.find(rel);
    const out = AppCache.toEntryName(pth);

    try {
      await fsStat(out);
    } catch {
      const stream = await ImageUtil.optimizePng(pth);
      await SystemUtil.streamToFile(stream, out);
    }

    return fsReadFile(out);
  }

  get wrapper() {
    return this.templates['email/wrapper.html'];
  }

  async compile(tpl: string) {
    // Load wrapper
    tpl = TemplateUtil.wrapWithBody(tpl, this.wrapper);

    // Resolve mustache partials
    tpl = await TemplateUtil.resolveNestedTemplates(tpl, await this.templates);

    let html = Inky.render(tpl);

    const css = await this.compiledStyles;
    const styles = [`<style>\n${css}\n</style>`];

    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (all) => {
      styles.push(all);
      return '';
    });

    html = html
      .replace(/<\/head>/, all => `${styles.join('\n')}\n${all}`)
      .replace(/%EMAIL_WIDTH%/g, `${this.defaultTemplateWidth}`);

    // Inline Images
    html = await TemplateUtil.inlineImageSource(html, (k) => this.getImage(k));

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text };
  }

  async getCompiled(template: string) {
    if (!this.cache[template]) {
      await this.initTemplates();
      this.cache[template] = await this.compile(this.templates[template] || template); // Handle if template is not a name
    }
    return this.cache[template];
  }

  async interpolate(text: string, context: MailTemplateContext = {}) {
    return TemplateUtil.interpolate(text, context);
  }

  async template(template: string, context: MailTemplateContext = {}) {
    const { html, text } = await this.getCompiled(template);

    // Render final template
    return {
      html: TemplateUtil.interpolate(html, context),
      text: TemplateUtil.interpolate(text, context)
    };
  }
}