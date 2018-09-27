import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

import { AppCache } from '@travetto/base/src/cache';
import { Injectable, Inject } from '@travetto/di';
import { MailTemplateEngine, MailTemplateContext } from '@travetto/email';

import { TemplateUtil } from './util';
import { MailTemplateConfig } from './config';
import { Inky } from './inky';
import { MarkdownUtil } from './markdown';

const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);

@Injectable()
export class DefaultMailTemplateEngine extends MailTemplateEngine {

  private templates: { [key: string]: string } = {};
  private cache: { [key: string]: { html: string, text: string } } = {};

  @Inject()
  private config: MailTemplateConfig;

  private _wrapper: Promise<string>;
  private _compiledSass: Promise<string>;

  get wrapper(): Promise<string> {
    if (!this._wrapper) {
      this._wrapper = this.config.findFirst('/html/wrapper.html')
        .then(f => fs.readFileSync(f))
        .then(x => x.toString());
    }
    return this._wrapper;
  }

  get compiledSass(): Promise<string> {
    if (!this._compiledSass) {
      this._compiledSass = (async () => {
        const partial = '/scss/app.scss';
        const full = path.resolve(`${__dirname}/../assets/${partial}`);

        if (!AppCache.hasEntry(full)) {
          const file = await this.config.findFirst(partial);
          const css = await TemplateUtil.compileSass(file, this.config.scssRoots);
          AppCache.writeEntry(full, css);
          return css;
        } else {
          return AppCache.readEntry(full);
        }
      })();
    }
    return this._compiledSass;
  }

  async registerTemplateFile(pth: string, name?: string) {
    if (!name) {
      name = pth.split('/').pop() as string;
    }
    const contents = await readFile(pth);
    this.registerTemplate(name, contents.toString());
  }

  registerTemplate(name: string, partial: string) {
    this.templates[name] = partial;
  }

  async getAssetBuffer(rel: string) {
    const pth = await this.config.findFirst(rel);
    const out = AppCache.toEntryName(pth);

    if (!(await exists(out))) {
      await TemplateUtil.optimizeImage(pth, out);
    }

    return readFile(out);
  }

  async compile(tpl: string) {
    // Load wrapper
    tpl = TemplateUtil.wrapWithBody(tpl, await this.wrapper);

    // Resolve mustache partials
    tpl = await TemplateUtil.resolveNestedTemplates(tpl, this.templates);

    let html = Inky.render(tpl);

    const css = await this.compiledSass;
    const styles = [`<style>\n${css}\n</style>`];

    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (all) => {
      styles.push(all);
      return '';
    });

    html = html
      .replace(/<\/head>/, all => `${styles.join('\n')}\n${all}`)
      .replace(/%WIDTH%/g, `580`);

    // Inline Images
    html = await TemplateUtil.inlineImageSource(html, (k) => this.getAssetBuffer(k));

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text };
  }

  async getCompiled(template: string) {
    if (!this.cache[template]) {
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