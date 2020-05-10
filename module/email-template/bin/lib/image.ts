import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

import { AppCache, FsUtil } from '@travetto/boot';
import { SystemUtil } from '@travetto/base/src/internal/system';

const fsReadFile = util.promisify(fs.readFile);

export class ImageUtil {

  /**
   * Inline image sources
   */
  static async inlineImageSource(html: string) {
    const srcs: string[] = [];

    html.replace(/(<img[^>]src=")([^"]+)/g, (__, __2, src) => {
      if (!src.startsWith('http')) {
        srcs.push(src);
      }
      return '';
    });

    const pendingImages = srcs.map(async src => {
      const [, ext] = path.extname(src).split('.');
      const data = (await this.getImage(src)).toString('base64');

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


  /**
   * Fetch image, compress and return as buffer
   */
  static async getImage(rel: string) {
    const { ResourceManager } = await import('@travetto/base');
    const { ImageUtil: ImgUtil } = await import('@travetto/image');

    const pth = await ResourceManager.find(rel);
    const out = AppCache.toEntryName(pth);

    if (!(await FsUtil.exists(out))) {
      const stream = await ImgUtil.optimizePng(pth);
      await SystemUtil.streamToFile(stream, out);
    }

    return fsReadFile(out);
  }
}