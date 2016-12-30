import * as nodemailer from 'nodemailer';
import * as marked from 'marked';
import * as Mustache from 'mustache';
import Config from './config';
import { nodeToPromise } from '@encore/util';

let juice = require('juice');

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false
});

export class EmailService {
  static transport = nodemailer.createTransport(Config.transport);

  static template(template: string, context: any): string {
    let templ = Mustache.render(template, context);
    let mark = marked(templ);
    let html = juice(mark);
    return html;
  }

  static async sendEmail(to: string, subject: string, template: string, context: any) {
    let html = EmailService.template(template, context);
    let emailOptions = { from: Config.from, to, subject, html };
    let tp = EmailService.transport;

    return nodeToPromise<nodemailer.SentMessageInfo>(tp, tp.sendMail, emailOptions);
  }
} 