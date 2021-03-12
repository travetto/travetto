import * as path from 'path';
import { PathUtil } from '@travetto/boot';

export class ImageUtil {

  /**
   * Inline image sources
   */
  static async inlineImageSource(html: string, root: string) {
    const { ImageUtil: ImgUtil } = await import('@travetto/image');

    const srcs: string[] = [];

    html = html.replace(/(<img[^>]src=")([^"]+)/g, (all, pre, src) => {
      if (!src.startsWith('http')) {
        const resolved = PathUtil.resolveUnix(root, src).replace(/^.*\/resources\//, '/');
        srcs.push(resolved);
        return `${pre}${resolved}`;
      }
      return all;
    });

    const pendingImages = srcs.map(async src => {
      const [, ext] = path.extname(src).split('.');
      const data = (await ImgUtil.optimizeResource(src)).toString('base64');

      return { data, ext, src };
    });

    const images = await Promise.all(pendingImages);
    const imageMap = new Map(images.map(x => [x.src, x]));

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
}