import * as nodemailer from 'nodemailer';
import * as Mustache from 'mustache';
import * as fs from 'fs';
import Config from './config';
import { nodeToPromise } from '@encore/util';
import { TemplateMailOptions, TemplateContext } from './types';

const juice = require('juice');
const Inky = require('inky').Inky;

export class EmailService {
  private static transport: nodemailer.Transporter;

  private static partials: { [key: string]: string } = {
    'foundationCss.html': fs.readFileSync(require.resolve('../data/foundationCss.html')).toString()
  };

  private static wrappers: { [key: string]: string } = {
    base: fs.readFileSync(require.resolve('../data/foundation.html')).toString(),
  };

  private static cache: { [key: string]: { [key: string]: string } } = { base: {} };

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

  static registerPartialFile(path: string, name?: string) {
    if (!name) {
      name = path.split('/').pop() as string;
    }
    EmailService.registerPartial(name, fs.readFileSync(path).toString());
  }

  static registerPartial(name: string, partial: string) {
    EmailService.partials[name] = partial;
  }

  static registerWrapperFile(path: string, name?: string) {
    if (!name) {
      name = path.split('/').pop() as string;
    }
    EmailService.registerWrapper(name, fs.readFileSync(path).toString());
  }

  static registerWrapper(name: string, wrapper: string) {
    EmailService.wrappers[name] = wrapper;
    EmailService.cache[name] = {};
  }

  static template(template: string, context: TemplateContext = {}) {

    let wrapperKey = context.wrapperName || 'base';

    if (!EmailService.cache[wrapperKey][template]) {
      let html = EmailService.wrappers[wrapperKey].replace('<!-- TEMPLATE -->', template);

      html = html.replace(/\{\{>\s+(\S+)\s*\}\}/g, (all: string, name: string) => {
        return EmailService.partials[name];
      });

      // The same plugin settings are passed in the constructor
      html = new Inky(Config.inky).releaseTheKraken(html);

      // Extract CSS
      html = juice(html, { preserveImportant: true });

      // Collect remaining styles (should be media queries) 
      let styles: string[] = [];
      html = html.replace(/<style[^>]*>[\s|\S]+<\/style>/g, function (style: string) {
        styles.push(style);
        return '';
      });

      // Move remaining styles into body
      html = html.replace('<!-- STYLES -->', styles.join('\n'));
      EmailService.cache[wrapperKey][template] = html;
    }

    // Render final template
    return Mustache.render(EmailService.cache[wrapperKey][template], context);
  }

  static async sendEmail(contexts: TemplateMailOptions | TemplateMailOptions[], base?: TemplateMailOptions) {
    let arr = Array.isArray(contexts) ? contexts : [contexts];
    let promises = arr.map((ctx) => {
      if (base) {
        ctx = Object.assign({}, base, ctx);
        if (base.context) {
          ctx.context = Object.assign({}, base.context, ctx.context);
        }
      }

      if (ctx.body) {
        ctx.html = EmailService.template(ctx.body, ctx.context);
        ctx.text = ctx.body.replace(/<[^>]+>/g, ' ');
      }

      if (ctx.subject) {
        ctx.subject = Mustache.render(ctx.subject, ctx.context);
      }

      return EmailService.sendEmailRaw(ctx);
    });
    return Promise.all(promises);
  }

  static async sendEmailRaw(options: nodemailer.SendMailOptions) {
    options = Object.assign({}, Config.defaults, options);
    let tp = EmailService.getTransport();
    return nodeToPromise<nodemailer.SentMessageInfo>(tp, tp.sendMail, options);
  }
} 