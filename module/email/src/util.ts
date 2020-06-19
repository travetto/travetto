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
        contentDisposition: 'inline',
        contentType: type
      });
      return `cid:${cid}`;
    });

    return {
      html, attachments
    };
  }
}