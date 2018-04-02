import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as util from 'util';

import { TemplateMailOptions, TemplateContext } from './types';
import { Injectable } from '@travetto/di';
import { MailConfig } from './config';
import { TemplateEngine } from './template';

const readFilePromise = util.promisify(fs.readFile);

@Injectable()
export class EmailService {

  private transporter: nodemailer.Transporter;

  constructor(
    private config: MailConfig,
    private tplEngine: TemplateEngine
  ) { }

  async postConstruct() {
    let transport: nodemailer.Transport;
    if (!this.config.transport) {
      const mockTransport = require('nodemailer-mock-transport');
      transport = mockTransport();
    } else if (this.config.transport === 'sendmail') {
      const sendmailTransport = require('nodemailer-sendmail-transport');
      transport = sendmailTransport({ path: '/usr/sbin/sendmail' });
    } else {
      const smtpTransport = require('nodemailer-smtp-transport');
      transport = smtpTransport(this.config.transport);
    }

    this.transporter = nodemailer.createTransport(transport);
  }

  async sendEmail(contexts: TemplateMailOptions | TemplateMailOptions[], base?: TemplateMailOptions) {
    const arr = Array.isArray(contexts) ? contexts : [contexts];

    const promises = arr.map(async (ctx) => {
      if (base) {
        ctx = { ...base, ...ctx };
        if (base.context) {
          ctx.context = { ...base.context, ...ctx.context };
        }
      }

      ctx.attachments = [];

      const { html, text } = await this.tplEngine.template(ctx.template, ctx.context);
      let x = 0;

      ctx.html = html.replace(/data:(image\/[^;]+);base64,([^"]+)/g, (_, type, content) => {
        const cid = `${++x}`;
        ctx.attachments!.push({
          cid,
          content: Buffer.from(content, 'base64'),
          contentType: type
        });
        return `cid:${cid}`;
      });

      ctx.text = text;

      if (ctx.subject) {
        ctx.subject = this.tplEngine.interpolate(ctx.subject, ctx.context);
      }

      return this.sendEmailRaw(ctx);
    });

    return Promise.all(promises);
  }

  async sendEmailRaw(options: nodemailer.SendMailOptions) {
    options = { ...this.config.defaults, ...options } as nodemailer.SendMailOptions;
    const tp = this.transporter;
    (await util.promisify(tp.sendMail).call(tp, options)) as nodemailer.SentMessageInfo;
    return options;
  }
}