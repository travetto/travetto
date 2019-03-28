import * as nodemailer from 'nodemailer';

import { Injectable } from '@travetto/di';
import { MailTransport, MessageOptions, SentMessage } from '..';

@Injectable()
export class NodemailerTransport extends MailTransport {
  private transport: nodemailer.Transporter;

  constructor(transportFactory: nodemailer.Transport) {
    super();
    this.transport = nodemailer.createTransport(transportFactory);
  }

  sendMail(mail: MessageOptions): Promise<SentMessage> {
    return new Promise<SentMessage>((resolve, reject) => {
      this.transport.sendMail(mail as nodemailer.SendMailOptions, (err, val) => {
        if (err) {
          reject(err);
        } else {
          resolve(val);
        }
      });
    });
  }
}