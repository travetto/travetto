import { createReadStream } from 'fs';

import * as path from '@travetto/path';
import { ImageConverter as ImgUtil } from '@travetto/image';
import { ResourceManager } from '@travetto/resource';
import { StreamUtil } from '@travetto/base';

export class ImageUtil {

  static sourceHandler(
    resolver: (href: string) => string,
    [lTok, rTok]: [string, string],
    all: string,
    prefix: string,
    src: string
  ): string {
    if (/^['"](.*)['"]$/.test(src)) {
      src = src.substring(1, src.length - 1); // Trim
    }
    if (!src.startsWith('http')) {
      return `${prefix}${lTok}${resolver(src)}${rTok}`;
    }
    return all;
  }

  /**
   * Inline image sources
   */
  static async inlineImageSource(html: string, srcResolver: (key: string) => string): Promise<string> {
    const imageSources = new Set<string>();
    const resolver = (x: string): string => {
      const og = srcResolver(x);
      const [, resolved] = og.split('/resources/');
      imageSources.add(resolved ?? og);
      return resolved ?? og;
    };

    html = html
      .replace(/(<img[^>]src=\s*["'])([^"]+)/g, (_, pre, src) => this.sourceHandler(resolver, ['@@', '@@'], _, pre, src))
      .replace(/(background(?:-image)?:\s*url[(])([^)]+)/g, (_, pre, src) => this.sourceHandler(resolver, ['\'@@', '@@\''], _, pre, src));

    const pendingImages = [...imageSources]
      .map(src => {
        const [, ext] = path.extname(src).split('.');
        switch (ext) {
          case 'jpg':
          case 'jpeg': return ['jpeg', src] as const;
          case 'png': return ['png', src] as const;
          default: return undefined;
        }
      })
      .filter((x): x is Exclude<typeof x, undefined> => !!x)
      .map(async ([ext, src]) => {
        const stream = createReadStream(await ResourceManager.find(src));
        const outputStream = await ImgUtil.optimize(ext, stream);
        const buffer = await StreamUtil.streamToBuffer(outputStream);
        const data = buffer.toString('base64');

        return [src, { data, ext, src }] as const;
      });

    const imageMap = new Map(await Promise.all(pendingImages));

    html = html.replace(/@@([^@]+)@@/g, (a, src) => {
      const { ext, data } = imageMap.get(src)!; // Inline local images
      return `data:image/${ext};base64,${data}`;
    });

    return html;
  }
}