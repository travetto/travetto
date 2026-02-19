import type { Readable } from 'node:stream';

import { createTransport, type Transporter, type Transport as TransportType } from 'nodemailer';
import type json from 'nodemailer/lib/json-transport';
import type smtp from 'nodemailer/lib/smtp-transport';
import type ses from 'nodemailer/lib/ses-transport';
import type sendmail from 'nodemailer/lib/sendmail-transport';

import { type MailTransport, type EmailOptions, type SentEmail } from '@travetto/email';
import { BinaryUtil, castTo, CodecUtil } from '@travetto/runtime';

type Transport = TransportType | json.Options | smtp.Options | ses.Options | sendmail.Options;

/**
 * Nodemailer transport, takes in a transport factory as the input
 */
export class NodemailerTransport implements MailTransport {
  #transport: Transporter<SentEmail & {
    rejected?: unknown[];
  }>;

  /**
  * Enforce attachment content is a buffer or stream, converting from string or binary array if needed
  */
  #enforceAttachmentContent(message: EmailOptions): EmailOptions<Readable | Buffer> {
    for (const attachment of message.attachments ?? []) {
      if (attachment.content) {
        if (typeof attachment.content === 'string') {
          attachment.content = CodecUtil.fromUTF8String(attachment.content);
        } else if (BinaryUtil.isBinaryArray(attachment.content)) {
          attachment.content = BinaryUtil.binaryArrayToUint8Array(attachment.content);
        } else {
          attachment.content = BinaryUtil.toReadable(attachment.content);
        }
      }
    }
    return castTo(message);
  }

  /**
   * Force content into alternative slots
   */
  #forceContentToAlternative(message: EmailOptions): EmailOptions {
    for (const [key, mime] of [['text', 'text/plain'], ['html', 'text/html']] as const) {
      if (message[key]) {
        (message.alternatives ??= []).push({
          content: message[key],
          contentDisposition: 'inline',
          contentTransferEncoding: '7bit',
          contentType: `${mime}; charset=utf-8`
        });
        delete message[key];
      }
    }

    return message;
  }

  constructor(transportFactory: Transport) {
    this.#transport = createTransport(transportFactory);
  }

  async send<S extends SentEmail = SentEmail>(mail: EmailOptions): Promise<S> {

    const forced = this.#enforceAttachmentContent(this.#forceContentToAlternative(mail));

    const response = await this.#transport.sendMail(forced);

    if (response.rejected?.length) {
      console.error('Unable to send emails', { recipientCount: response.rejected?.length });
    }

    return castTo(response);
  }
}