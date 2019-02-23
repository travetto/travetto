import * as Mustache from 'mustache';
import * as fs from 'fs';
import * as path from 'path';

import { FsUtil } from '@travetto/base';
import { CommandService } from '@travetto/exec';

export class TemplateUtil {

  static converter = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  static async compileSass(file: string, roots: string[]) {
    return new Promise<string>((resolve, reject) => {
      const sass = require('sass') as { render(args: any, cb: (err: any, results: { css: string | Buffer }) => void): void };
      sass.render({
        file,
        sourceMap: false,
        includePaths: roots
      }, (err, res) => {
        if (err) {
          reject(err);
        } else {
          const css = res.css.toString();
          resolve(css);
        }
      });
    });
  }

  static interpolate(text: string, data: any) {
    return Mustache.render(text, data);
  }

  static wrapWithBody(tpl: string, wrapper: string) {
    // Wrap template, with preamble/postamble
    return wrapper.replace('<!-- BODY -->', tpl);
  }

  static async optimizeImage(file: string, out: string) {
    const { process: proc, result: prom } = await this.converter.exec('pngquant', '--quality', '40-80', '--speed', '1', '--force', '-');
    fs.createReadStream(file).pipe(proc.stdin);
    proc.stdout.pipe(fs.createWriteStream(out));
    await prom;
  }

  static async inlineImageSource(html: string, lookup: (src: string) => (Buffer | Promise<Buffer>)) {
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
      const data = (await lookup(src)).toString('base64');

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

  static resolveNestedTemplates(template: string, templates: { [key: string]: string }) {
    return template.replace(/[{]{2}>\s+(\S+)\s*[}]{2}/g, (all: string, name: string): any => {
      name = FsUtil.toUnix(name);
      return this.resolveNestedTemplates(templates[name], templates);
    });
  }
}