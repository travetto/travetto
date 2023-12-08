import { RuntimeIndex } from '@travetto/manifest';

import { EmailAttachment } from './types';

/**
 * Utilities for email
 */
export class MailUtil {
  /** Remove brand from text */
  static purgeBrand(text: string): string {
    return text.replace(/<!-- WARNING:[^\n]*\n/m, '');
  }

  /** Add brand to text */
  static buildBrand(file: string, content: string, compile?: string): string {
    const out = [
      'WARNING: Do not modify.',
      `File is generated from "${file.replace(RuntimeIndex.manifest.workspacePath, '.')}"`,
      compile ? `Run \`${compile.replaceAll('\n', ' ')}\` to regenerate` : ''
    ];
    return `<!-- ${out.join(' ').trim()}   -->\n${content}`;
  }

  /**
   * Extract images from html as attachments
   *
   * @param html
   */
  static async extractImageAttachments(html: string): Promise<{ html: string, attachments: EmailAttachment[] }> {
    let idx = 0;
    const attachments: EmailAttachment[] = [];
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