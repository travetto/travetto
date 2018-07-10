/// <reference path="./types.d.ts" />

import * as inlineCss from 'inline-css';
import * as inky from 'inky';
import * as path from 'path';
import * as fs from 'fs';
import * as htmlEntities from 'html-entities';
import * as marked from 'marked';
import * as util from 'util';
import * as Mustache from 'mustache';

import { AppCache } from '@travetto/base/src/cache';
import { CommandService, ExecUtil } from '@travetto/exec';
import { Injectable } from '@travetto/di';

import { TemplateContext } from './types';
import { MailTemplateConfig } from './config';

const sass = require('sass');

const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);

const Inky = inky.Inky;

const allEntities = new htmlEntities.AllHtmlEntities();

class Renderer extends marked.Renderer {
  strong(text: string) {
    return `*${text}*`;
  }
  hr() {
    return `\n\n-------------------\n\n`;
  }
  link(href: string, title: string, text: string): string {
    return `[${title}]( ${href} )`;
  }
}

@Injectable()
export class TemplateEngine {

  private wrapper: Promise<string>;
  private css: Promise<string>;

  private templates: { [key: string]: string } = {};
  private cache: { [key: string]: { html: string, text: string } } = {};

  private converter = new CommandService({
    image: 'agregad/pngquant',
    checkForLocal: async () => {
      return (await ExecUtil.spawn('pngquant -h')[1]).valid;
    }
  });

  // TODO: figure out paths for html, images, and partials
  constructor(public config: MailTemplateConfig) {

    this.wrapper = this.config.findFirst('/html/wrapper.html')
      .then(f => fs.readFileSync(f))
      .then(x => x.toString());

    this.css = new Promise<string>(async (resolve, reject) => {
      const partial = '/scss/app.scss';
      const full = path.resolve(`${__dirname}/../assets/email/${partial}`);
      if (!AppCache.hasEntry(full)) {
        const file = await this.config.findFirst(partial);

        sass.render({
          file,
          sourceMap: false,
          includePaths: this.config.scssRoots
        }, (err: any, res: { css: any }) => {
          if (err) {
            reject(err);
          } else {
            const css = res.css.toString();
            AppCache.writeEntry(full, css);
            resolve(css);
          }
        });
      } else {
        resolve(AppCache.readEntry(full));
      }
    });
  }

  interpolate(text: string, data: any) {
    return Mustache.render(text, data);
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

  async htmlToMarkdown(html: string) {
    // Cleanup html from templating
    let simple = html
      .replace(/<table[^>]*spacer[^>]*>.*?<\/table>/g, x => { // Turn spacers into <br>
        const height = parseInt(x.split('font-size:')[1].split(';')[0].trim().replace('px', ''), 10);
        return '<br>'.repeat(Math.ceil(height / 16));
      })
      .replace(/<div class="hr[^>]+>/g, '<hr>')
      .replace(/<[/]?(table|tr|th|thead|tbody|td|center|span|div|img)[^>]*>/g, '') // Remove purely structuring tags
      .replace(/&#xA0;/g, ' ') // Remove entities
      .replace(/style="[^"]+"/g, ''); // Remove all style tags

    // Decode all encoded pieces
    simple = allEntities.decode(simple);

    const finalText = marked(simple, {
      gfm: true,
      renderer: new Renderer()
    });

    return finalText;
  }

  async wrapTemplate(tpl: string) {
    // Compile SASS
    tpl = tpl
      .replace(/<\/button>/g, (all) => `${all}<spacer size="16"></spacer>`) // Insert spacers
      .replace(/<hr[^>]*>/g, (a, e) => { // Turn <hr> to <div class="hr">
        const classes = ['hr'];
        const woClasses = a.replace(/class="([^"]*)"/g, (b, c) => { classes.push(c); return ''; });
        return a
          .replace(/<hr/, `<div class="${classes.join(' ')}"`)
          .replace(/[/]?>/, '></div>');
      }); // Pull out hrs

    // Wrap template, with preamble/postamble
    tpl = (await this.wrapper)
      .replace('<!-- BODY -->', tpl)
      .replace(/%WIDTH%/g, `580`);

    return tpl;
  }

  async resolveNestedTemplates(template: string) {
    return template.replace(/[{]{2}>\s+(\S+)\s*[}]{2}/g, (all: string, name: string): any => {
      return this.resolveNestedTemplates(this.templates[name]);
    });
  }

  async getAssetBuffer(rel: string) {
    const pth = await this.config.findFirst(rel);
    const out = AppCache.toEntryName(pth);

    if (!(await exists(out))) {
      const [proc, prom] = await this.converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
      fs.createReadStream(pth).pipe(proc.stdin);
      proc.stdout.pipe(fs.createWriteStream(out));
      await prom;
    }

    const buffer = await readFile(out);

    return buffer;
  }

  async inlineImageSource(html: string) {
    const srcs: string[] = [];

    html.replace(/(<img[^>]src=")([^"]+)/g, (a: string, pre: string, src: string) => {
      if (!src.startsWith('http')) {
        srcs.push(src);
      }
      return '';
    });

    const pendingImages = srcs.map(async src => {
      // TODO: fix this up?
      const ext = path.extname(src).split('.')[1];
      const data = (await this.getAssetBuffer(src)).toString('base64');

      return { data, ext, src };
    });

    const images = await Promise.all(pendingImages);
    const imageMap = new Map(images.map(x => [x.src, x] as [string, { ext: string, data: string }]));

    html = html.replace(/(<img[^>]src=")([^"]+)/g, (a, pre, src) => {
      if (imageMap.has(src)) {
        const { ext, data } = imageMap.get(src)!; // Inline local images
        return `${pre}data:image/${ext};base64,${data}`;
      } else {
        return a;
      }
    });

    return html;
  }

  async compile(tpl: string) {
    // Load wrapper
    tpl = await this.wrapTemplate(tpl);

    // Resolve mustach partials
    tpl = await this.resolveNestedTemplates(tpl);

    // Inky compiler
    let html = new Inky().releaseTheKraken(tpl);

    // Inline CSS
    html = await inlineCss(html, {
      extraCss: await this.css,
      preserveImportant: true,
      url: `https://bad.com/`
    } as any);

    // Take care of various minor fixes
    html = html
      .replace(/<(meta|img|link|hr|br)[^>]*>/g, a => a.replace('>', '/>')) // Fix self closing
      .replace(/&apos;/g, '&#39;') // Fix apostrophes, as outlook hates them
      .replace(/(background(?:-color)?:\s*)([#0-9a-fA-F]+)([^>]+)>/g,
        (all, p, col, rest) => `${p}${col}${rest} bgcolor="${col}">`) // Inline bg-color
      .replace(/<([^>]+vertical-align:\s*(top|bottom|middle)[^>]+)>/g,
        (a, tag, valign) => tag.indexOf('valign') ? `<${tag}>` : `<${tag} valign="${valign}">`) // Vertically align if it has the style
      .replace(/<(table[^>]+expand[^>]+width:\s*)(100%\s+!important)([^>]+)>/g,
        (a, left, size, right) => `<${left}100%${right}>`); // Drop important as a fix for outlook;

    // Inline Images
    html = await this.inlineImageSource(html);

    // Generate text version
    const text = await this.htmlToMarkdown(html);

    return { html, text };
  }

  async getCompiled(template: string) {
    if (!this.cache[template]) {
      this.cache[template] = await this.compile(this.templates[template] || template); // Handle if template is not a name
    }
    return this.cache[template];
  }

  async template(template: string, context: TemplateContext = {}) {
    const { html, text } = await this.getCompiled(template);

    // Render final template
    return {
      html: this.interpolate(html, context),
      text: this.interpolate(text, context)
    };
  }
}