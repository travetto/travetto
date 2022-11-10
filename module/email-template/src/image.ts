import * as path from '@travetto/path';
import { ImageConverter as ImgUtil } from '@travetto/image';
import { StreamUtil } from '@travetto/base';
import { EmailResources } from './resources';

type Resolver = (src: string) => (string | Promise<string>);

export class ImageUtil {

  /**
   * Inline image sources
   */
  static async inlineImageSource(html: string, srcResolver: Resolver): Promise<string> {
    const imageSources = new Set<string>();
    const resolver = async (x: string): Promise<string> => {
      const og = await srcResolver(x);
      const [, resolved] = og.split('/resources/');
      imageSources.add(resolved ?? og);
      return resolved ?? og;
    };

    for (const [pattern, combine] of [
      [/(?<pre><img[^>]src=\s*["'])(?<src>[^"]+)/g, (x: string) => `@@${x}@@`],
      [/(?<pre>background(?:-image)?:\s*url[(])(?<src>[^)]+)/g, (x: string) => `'@@${x}@@'`]
    ] as const) {
      for (let { [0]: all, groups: { pre, src } = { pre: '', src: '' } } of html.matchAll(pattern)) {
        if (/^['"](.*)['"]$/.test(src)) {
          src = src.substring(1, src.length - 1); // Trim
        }
        if (!src.startsWith('http')) {
          html.replace(all, `${pre}${combine(await resolver(src))}`);
        }
      }
    }

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
        const stream = await EmailResources.readStream(src);
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