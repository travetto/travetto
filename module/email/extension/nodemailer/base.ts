import * as nodemailer from 'nodemailer';

import { MailTransport, MessageOptions, SentMessage } from '../../src/types';

export abstract class BaseTransport extends MailTransport {
  private transporter: nodemailer.Transporter;

  abstract getTransport(): nodemailer.Transport;

  async postConstruct() {
    this.transporter = nodemailer.createTransport(this.getTransport());
  }

  sendMail(mail: MessageOptions): Promise<SentMessage> {
    return new Promise<SentMessage>((resolve, reject) => {
      this.transporter.sendMail(mail, (err, val) => {
        if (err) {
          reject(err);
        } else {
          resolve(val);
        }
      });
    });
  }
}