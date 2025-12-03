import { Runtime, BinaryUtil } from '@travetto/runtime';

import { EmailAttachment, EmailIdentity, EmailIdentityList, EmailOptions } from './types.ts';

/**
 * Utilities for email
 */
export class MailUtil {
  /** Remove brand from text */
  static purgeBrand(text: string): string {
    return text.replace(/<!-- WARNING:[^\n]{0,500}\n/m, '');
  }

  /** Add brand to text */
  static buildBrand(file: string, content: string, compile?: string): string {
    const out = [
      'WARNING: Do not modify.',
      `File is generated from "${file.replace(Runtime.workspace.path, '.')}"`,
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

    // Max of 10mb
    html = html.replace(/data:(image\/[^;]{1,50});base64,([^"']{1,10000000})/g, (__, contentType, content) => {
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

  /**
   * Get the primary email, if set from an email identity or identity list
   */
  static getPrimaryEmail(identity?: EmailIdentity | EmailIdentityList): string | undefined {
    if (!identity) {
      return;
    }
    if (Array.isArray(identity)) {
      identity = identity[0];
    }
    return (typeof identity === 'string') ? identity : identity.address;
  }

  /**
   * Build a unique message id
   */
  static buildUniqueMessageId(message: EmailOptions): string {
    const from = this.getPrimaryEmail(message.from)!;
    const to = this.getPrimaryEmail(message.to)!;
    const uid = BinaryUtil.hash(`${to}${from}${message.subject}${Date.now()}`, 12);
    return `<${uid}@${from.split('@')[1]}>`;
  }
}