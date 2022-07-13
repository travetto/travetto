import * as path from 'path';
import { PathUtil } from '@travetto/boot';

export class ImageUtil {

  static sourceHandler(resolver: (src: string) => string, token: string, all: string, prefix: string, src: string) {
    if (/^['"](.*)['"]$/.test(src)) {
      src = src.substring(1, src.length - 1); // Trim 
    }
    if (!src.startsWith('http')) {
      return `${prefix}"${token}${resolver(src)}${token}"`;
    }
    return all;
  }

  /**
   * Inline image sources
   */
  static async inlineImageSource(html: string, root: string) {
    const { ImageUtil: ImgUtil } = await import('@travetto/image');

    const imageSources = new Set<string>();
    const replacer = this.sourceHandler.bind(null, x => {
      const resolved = PathUtil.resolveUnix(root, x).replace(/^.*\/resources\//, '/');
      imageSources.add(resolved);
      return resolved;
    }, '@@');


    html = html
      .replace(/(<img[^>]src=\s*)(["']?[^"]+["']?)/g, replacer)
      .replace(/(background(?:-image)?:\s*url[(])([^)]+)/g, replacer);

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