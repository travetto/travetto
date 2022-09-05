import * as nodemailer from 'nodemailer';
import type * as json from 'nodemailer/lib/json-transport';
import type * as smtp from 'nodemailer/lib/smtp-transport';
import type * as ses from 'nodemailer/lib/ses-transport';
import type * as sendmail from 'nodemailer/lib/sendmail-transport';

import { MailTransport, MessageOptions, SentMessage } from '@travetto/email';

type Transport = nodemailer.Transport | json.Options | smtp.Options | ses.Options | sendmail.Options;

/**
 * Nodemailer transport, takes in a transport factory as the input
 */
export class NodemailerTransport implements MailTransport {
  #transport: nodemailer.Transporter;

  constructor(transportFactory: Transport) {
    this.#transport = nodemailer.createTransport(transportFactory);
  }

  async send<S extends SentMessage = SentMessage>(mail: MessageOptions): Promise<S> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = await this.#transport.sendMail(mail) as {
      messageId?: string;
      envelope?: Record<string, string>;
      accepted?: string[];
      rejected?: string[];
      pending?: string[];
      response?: string;
    };

    if (res.rejected?.length) {
      console.error('Unable to send emails', { recipientCount: res.rejected?.length });
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return res as S;
  }
}