import * as path from 'path';
import { Host, PathUtil } from '@travetto/boot';

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
  static async inlineImageSource(html: string, root: string): Promise<string> {
    const { ImageUtil: ImgUtil } = await import('@travetto/image');

    const imageSources = new Set<string>();
    const resolver = (x: string): string => {
      const og = PathUtil.resolveUnix(root, x);
      const [, resolved] = og.split(`/${Host.PATH.resources}/`);
      imageSources.add(resolved ?? og);
      return resolved ?? og;
    };

    html = html
      .replace(/(<img[^>]src=\s*["'])([^"]+)/g, (_, pre, src) => this.sourceHandler(resolver, ['@@', '@@'], _, pre, src))
      .replace(/(background(?:-image)?:\s*url[(])([^)]+)/g, (_, pre, src) => this.sourceHandler(resolver, ['\'@@', '@@\''], _, pre, src));

    const pendingImages = [...imageSources].map(async src => {
      const [, ext] = path.extname(src).split('.');
      const data = (await ImgUtil.optimizeResource(src)).toString('base64');

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