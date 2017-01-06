import * as nodemailer from 'nodemailer';
import * as marked from 'marked';
import * as Mustache from 'mustache';
import Config from './config';
import { nodeToPromise } from '@encore/util';

let juice = require('juice');

export class EmailService {
  private static transport: nodemailer.Transporter;

  private static buildTransport() {
    let transport: nodemailer.Transport;
    if (!Config.transport) {
      let mockTransport = require('nodemailer-mock-transport');
      transport = mockTransport();
    } else if ((Config as any).transport === 'sendmail') {
      let sendmailTransport = require('nodemailer-sendmail-transport');
      transport = sendmailTransport({
        path: '/usr/sbin/sendmail'
      });
    } else {
      let smtpTransport = require('nodemailer-smtp-transport');
      transport = smtpTransport(Config.transport);
    }
    return transport;
  }

  static getTransport() {
    if (EmailService.transport === undefined) {
      EmailService.transport = nodemailer.createTransport(EmailService.buildTransport());
    }
    return EmailService.transport;
  }


  static template(template: string, context: any): string {
    let templ = Mustache.render(template, context);
    let mark = marked(templ);
    let html = juice(mark);
    return html;
  }

  static async sendEmail(to: string, subject: string, template: string, context: any) {
    let html = EmailService.template(template, context);
    let emailOptions = { from: Config.from, to, subject, html };
    let tp = EmailService.getTransport();

    return nodeToPromise<nodemailer.SentMessageInfo>(tp, tp.sendMail, emailOptions);
  }
} 