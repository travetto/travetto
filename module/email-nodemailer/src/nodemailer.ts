import { createTransport, type Transporter, type Transport as TransportType } from 'nodemailer';
import type json from 'nodemailer/lib/json-transport';
import type smtp from 'nodemailer/lib/smtp-transport';
import type ses from 'nodemailer/lib/ses-transport';
import type sendmail from 'nodemailer/lib/sendmail-transport';

import { MailTransport, EmailOptions, SentEmail } from '@travetto/email';
import { castTo } from '@travetto/runtime';

type Transport = TransportType | json.Options | smtp.Options | ses.Options | sendmail.Options;

/**
 * Nodemailer transport, takes in a transport factory as the input
 */
export class NodemailerTransport implements MailTransport {
  #transport: Transporter<SentEmail & {
    rejected?: unknown[];
  }>;

  /**
   * Force content into alternative slots
   */
  #forceContentToAlternative(msg: EmailOptions): EmailOptions {
    for (const [key, mime] of [['text', 'text/plain'], ['html', 'text/html']] as const) {
      if (msg[key]) {
        (msg.alternatives ??= []).push({
          content: msg[key], contentDisposition: 'inline', contentTransferEncoding: '7bit', contentType: `${mime}; charset=utf-8`
        });
        delete msg[key];
      }
    }
    return msg;
  }

  constructor(transportFactory: Transport) {
    this.#transport = createTransport(transportFactory);
  }

  async send<S extends SentEmail = SentEmail>(mail: EmailOptions): Promise<S> {

    mail = this.#forceContentToAlternative(mail);

    const response = await this.#transport.sendMail(mail);

    if (response.rejected?.length) {
      console.error('Unable to send emails', { recipientCount: response.rejected?.length });
    }

    return castTo(response);
  }
}