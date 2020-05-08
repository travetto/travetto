import * as path from 'path';

import { Attachment } from './types';

/**
 * Utilities for email
 */
export class MailUtil {
  /**
   * Extract images from html as attachments
   *
   * @param html
   */
  static async extractImageAttachments(html: string) {
    let x = 0;
    const attachments: Attachment[] = [];

    html = html.replace(/data:(image\/[^;]+);base64,([^"]+)/g, (__, type, content) => {
      const cid = `${++x}`;
      attachments!.push({
        cid,
        content: Buffer.from(content, 'base64'),
        contentType: type
      });
      return `cid:${cid}`;
    });

    return {
      html, attachments
    };
  }

  /**
   * Inline image sources
   */
  static async inlineImageSource(html: string, lookup: (src: string) => (Buffer | Promise<Buffer>)) {
    const srcs: string[] = [];

    html.replace(/(<img[^>]src=")([^"]+)/g, (__, __2, src) => {
      if (!src.startsWith('http')) {
        srcs.push(src);
      }
      return '';
    });

    const pendingImages = srcs.map(async src => {
      const [, ext] = path.extname(src).split('.');
      const data = (await lookup(src)).toString('base64');

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