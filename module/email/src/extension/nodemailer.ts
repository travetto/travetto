// @file-if nodemailer
import * as nodemailer from 'nodemailer';
import * as json from 'nodemailer/lib/json-transport';
import * as smtp from 'nodemailer/lib/smtp-transport';
import * as ses from 'nodemailer/lib/ses-transport';
import * as sendmail from 'nodemailer/lib/sendmail-transport';

import { MessageOptions, SentMessage } from '../types';
import { MailTransport } from '../transport';

type Transport = nodemailer.Transport | json.Options | smtp.Options | ses.Options | sendmail.Options;

/**
 * Nodemailer transport, takes in a transport factory as the input
 */
export class NodemailerTransport implements MailTransport {
  private transport: nodemailer.Transporter;

  constructor(transportFactory: Transport) {
    this.transport = nodemailer.createTransport(transportFactory);
  }

  async send(mail: MessageOptions): Promise<SentMessage> {
    const res = await this.transport.sendMail(mail as nodemailer.SendMailOptions) as {
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

    return res;
  }
}