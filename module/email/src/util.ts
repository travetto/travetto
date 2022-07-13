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
    let idx = 0;
    const attachments: Attachment[] = [];
    const contentMap = new Map<string, string>();

    html = html.replace(/data:(image\/[^;]+);base64,([^"']+)/g, (__, contentType, content) => {
      // Ensure same data uris map to a single cid
      if (!contentMap.has(content)) {
        const cid = `image-${idx += 1}`;
        const ext = contentType.split('/')[1];
        attachments.push({
          cid,
          filename: `${cid}.${ext}`,
          headers: {
            'X-Attachment-Id': `${cid}`
          },
          content: Buffer.from(content, 'base64'),
          contentDisposition: 'inline',
          contentType
        });
        contentMap.set(content, cid);
        return `cid:${cid}`;
      } else {
        return contentMap.get(content)!;
      }
    });

    return {
      html, attachments
    };
  }
}