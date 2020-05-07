// @file-if nodemailer
import * as nodemailer from 'nodemailer';

import { MessageOptions, SentMessage } from '../types';
import { MailTransport } from '../transport';

/**
 * Nodemailer transport, takes in a transport factory as the input
 */
export class NodemailerTransport extends MailTransport {
  private transport: nodemailer.Transporter;

  constructor(transportFactory: nodemailer.Transport) {
    super();
    this.transport = nodemailer.createTransport(transportFactory);
  }

  sendMail(mail: MessageOptions): Promise<SentMessage> {
    return this.transport.sendMail(mail as nodemailer.SendMailOptions);
  }
}