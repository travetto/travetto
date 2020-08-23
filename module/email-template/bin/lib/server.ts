import * as http from 'http';
import * as url from 'url';
import * as Mustache from 'mustache';

import { Class } from '@travetto/registry';
import type { MailService } from '@travetto/email/src/service';
import { ConfigManager } from '@travetto/config';

import { TemplateUtil, MapLite } from './util';
import { ImageUtil } from './image';

const EMAIL = ConfigManager.get('email-dev');

export class DevServerUtil {

  private static _svc: Promise<MailService>;

  /**
   * Resolves listing
   */
  static async resolveIndex() {
    const { ResourceManager } = await import('@travetto/base');

    return {
      content: Mustache.render(await ResourceManager.read('email/index.dev.html', 'utf-8'), {
        templates: await TemplateUtil.findAllTemplates()
      }),
      contentType: 'text/html',
      static: true
    };
  }

  static async getService() {
    if (!this._svc) {
      const { MailService: M, MailTransport, NodemailerTransport } = await import('@travetto/email');
      const { DependencyRegistry } = await import('@travetto/di');

      if ('email-dev' in ConfigManager.get()) {
        const cls = class { };
        DependencyRegistry.registerFactory({
          fn: () => new NodemailerTransport(EMAIL as any),
          target: MailTransport as unknown as Class,
          src: cls,
          id: 'nodemailer',
        });

        DependencyRegistry.install(cls, { curr: cls, type: 'added' });
      } else if (!DependencyRegistry.getCandidateTypes(MailTransport as unknown as Class).length) {
        console.error(`=`.repeat(40));
        console.error('Please configure your email setup and/or credentials for testing. Under `email-dev` in your `dev.yml`');
        console.error('Email sending will not work until the above is fixed');
        console.error('If you want a free service to send emails, use https://ethereal.email/');
        console.error(`A sample configuration would look like:     
      email-dev:
        to: my-email@gmail.com
        port: 587,
        host: smtp.host.email
        auth:
          user:	email@blah.com
          pass: password
      `);
        console.error(`=`.repeat(40));
        return;
      }

      this._svc = DependencyRegistry.getInstance(M);
    }
    return this._svc;
  }

  /**
   * Resolve template
   */
  static async sendEmail(key: string, to: string, context: Record<string, any>) {
    try {
      console.log(`Sending email to ${to}`);
      await TemplateUtil.compileToDisk(key, true);
      // Let the engine template
      const svc = await this.getService();
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }
      const info = await svc.sendCompiled(key.split('.tpl')[0].split('email/')[1], { to, context });
      console.log(`Sent email to ${to}`);
      return {
        status: 200, message: 'Successfully sent',
        content: EMAIL.host?.includes('ethereal') ? JSON.stringify({ url: require('nodemailer').getTestMessageUrl(info) }) : '{}',
        contentType: 'application/json'
      };
    } catch (e) {
      console.log(`Failed to send email to ${to}`, e.message);
      console.error(e);
      throw e;
    }
  }

  /**
   * Resolve template
   */
  static async resolveTemplate(key: string, format: string, context: Record<string, any>, overrides: MapLite<string, string>) {
    const compiled = await TemplateUtil.compileToDisk(key, true);

    const { ResourceManager } = await import('@travetto/base');

    const content = format === 'txt' ?
      Mustache.render(await ResourceManager.read(`email/text.dev.html`, 'utf-8'), compiled) :
      compiled.html;

    const data = await TemplateUtil.buildContext(context, compiled.text, overrides);

    // Let the engine template
    const { MailTemplateEngine } = await import('@travetto/email');
    const { DependencyRegistry } = await import('@travetto/di');

    const engine = await DependencyRegistry.getInstance(MailTemplateEngine);
    return { content: await engine.template(content, data), contentType: 'text/html' };
  }

  /**
   * Resolve image
   */
  static async resolveImage(filename: string) {
    const content = await ImageUtil.getImage(filename);
    return { content };
  }

  /**
   * Resolve template into output
   */
  static async resolve(request: http.IncomingMessage) {
    const reqUrl = new url.URL(request.url!);
    const filename = reqUrl.pathname.substring(1) || 'index.html';
    const ext = filename.replace(/^.*?(?=[.](tpl[.])?[^.]+)/, '');
    const config = ConfigManager.get('email-dev');

    console.debug('Resolving', filename, ext);

    switch (ext) {
      case '.jpg':
      case '.png':
      case '.ico':
      case '.gif': return this.resolveImage(filename);
      case '.html': return this.resolveIndex();
      case '.tpl.html': {
        const context = await (async () => JSON.parse(reqUrl.searchParams.get('jsonContext') || '{}'))().catch(e => ({}));
        if (!/POST/i.test(request.method || '')) {
          const format = (reqUrl.searchParams.get('format') || 'html').toLowerCase();
          return this.resolveTemplate(filename, format, context, reqUrl.searchParams);
        } else {
          return this.sendEmail(filename, config.to, context);
        }
      }
      default: {
        console.log('Unknown request', request.url);
        return {
          content: '', contentType: 'text/plain', statusCode: 404
        };
      }
    }
  }

  /**
   * Register a change listener
   */
  static onChange(cb: () => void) {
    TemplateUtil.watchCompile(cb);
  }
}

setTimeout(() => DevServerUtil.getService(), 2000);