/// <reference path="./types.d.ts" />

import * as inlineCss from 'inline-css';
import * as inky from 'inky';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as htmlEntities from 'html-entities';
import * as toMarkdown from 'to-markdown';
import * as sass from 'node-sass';
import * as util from 'util';
import * as Mustache from 'mustache';
import { TemplateContext } from '.';
import { Injectable } from '@travetto/di';
import { MailTemplateConfig } from './config';

const PngQuant = require('pngquant');

const readFile = util.promisify(fs.readFile);
const Inky = inky.Inky;

const allEntities = new htmlEntities.AllHtmlEntities();

@Injectable()
export class TemplateEngine {

  private wrapper: Promise<string>;
  private css: Promise<string>;

  private templates: { [key: string]: string } = {};
  private cache: { [key: string]: { html: string, text: string } } = {};

  // TODO: figure out paths for html, images, and partials
  constructor(public config: MailTemplateConfig) {

    this.wrapper = this.config.findFirst('/html/wrapper.html')
      .then(f => readFile(f))
      .then(x => x.toString());

    this.css = new Promise<string>(async (resolve, reject) => {
      const file = await this.config.findFirst('/scss/app.scss');

      sass.render({
        file,
        sourceMap: false,
        includePaths: this.config.scssRoots
      }, (err, res) => err ? reject(err) : resolve(res.css.toString()));
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
    function getAttrs(node: HTMLElement) {
      const attrs: { [key: string]: string } = {};
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes.item(i);
        attrs[attr!.localName!] = attr!.value;
      }
      return attrs;
    }

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

    const text = toMarkdown(simple, {
      gfm: true,
      converters: [
        {
          filter: 'small',
          replacement: v => `*${v}*`
        },
        {
          filter: 'hr',
          replacement: x => `\n\n-------------------\n\n`
        },
        {
          filter: 'a',
          replacement: (x, node) => {
            const attrs = getAttrs(node);
            const href = attrs['href'];
            return `[${x}]( ${href} )`
          }
        }]
    });

    return text;
  }

  async wrapTemplate(tpl: string) {
    const css = await this.css;

    // Compile SASS
    tpl = tpl
      .replace(/<\/button>/g, (all) => `${all}<spacer size="16"></spacer>`) // Insert spacers
      .replace(/<hr[^>]*>/g, (a, e) => { // Turn <hr> to <div class="hr">
        const classes = ['hr']
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
    const bufs: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      const stream = fs.createReadStream(pth).pipe(new PngQuant([128]));
      stream.on('data', (d: Buffer) => bufs.push(d));
      stream.on('end', (err: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve(Buffer.concat(bufs));
        }
      });
    });
  }

  async inlineImageSource(html: string) {
    const srcs: string[] = [];

    html.replace(/(<img[^>]src=")([^"]+)/g, (a: string, pre: string, src: string) => { srcs.push(src); return '' });

    const pendingImages = srcs.map(async src => {
      // TODO: fix this up?
      const ext = path.extname(src).split('.')[1];
      const data = (await this.getAssetBuffer(src)).toString('base64');

      return { data, ext, src }
    });

    const images = await Promise.all(pendingImages);
    const imageMap = images.reduce((acc, v) => { acc[v.src] = v; return acc; },
      {} as { [key: string]: { ext: string, data: string } });

    html = html.replace(/(<img[^>]src=")([^"]+)/g, (a, pre, src) => { // Inline base64 images
      const { ext, data } = imageMap[src];
      return `${pre}data:image/${ext};base64,${data}`;
    })

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
        (a, left, size, right) => `<${left}100%${right}>`) // Drop important as a fix for outlook;

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