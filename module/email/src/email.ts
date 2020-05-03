import { Injectable } from '@travetto/di';

import { MessageOptions } from './types';
import { MailTransport } from './transport';
import { MailTemplateOptions, MailTemplateEngine } from './template';

@Injectable()
// TODO: Document
export class EmailService {

  constructor(
    private transport: MailTransport,
    private tplEngine?: MailTemplateEngine
  ) { }

  async sendTemplatedEmail(contexts: MailTemplateOptions | MailTemplateOptions[], base?: MailTemplateOptions) {
    if (!this.tplEngine) {
      throw new Error('Template engine has not been loaded, perhaps you should install @travetto/email-template');
    }

    const arr = Array.isArray(contexts) ? contexts : [contexts];

    const promises = arr.map(async (ctx) => {
      if (base) {
        ctx = { ...base, ...ctx };
        if (base.context) {
          ctx.context = { ...base.context, ...ctx.context };
        }
      }

      ctx.context = ctx.context ?? {};
      ctx.attachments = [];

      const { html, text } = await this.tplEngine!.template(ctx.template, ctx.context);
      let x = 0;

      ctx.html = html.replace(/data:(image\/[^;]+);base64,([^"]+)/g, (__, type, content) => {
        const cid = `${++x}`;
        ctx.attachments!.push({
          cid,
          content: Buffer.from(content, 'base64'),
          contentType: type
        });
        return `cid:${cid}`;
      });

      ctx.text = text;

      if (ctx.subject && ctx.context) {
        ctx.subject = await this.tplEngine!.interpolate(ctx.subject, ctx.context);
      }

      return this.sendEmail(ctx);
    });

    return Promise.all(promises);
  }

  async sendEmail(options: MessageOptions) {
    return this.transport.sendMail(options);
  }
}