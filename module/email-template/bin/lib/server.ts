import * as http from 'http';
import * as url from 'url';
import * as Mustache from 'mustache';

import type { MailService } from '@travetto/email/src/service';
import { ConfigManager } from '@travetto/config';

import { TemplateUtil, MapLite } from './util';
import { ImageUtil } from './image';

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
      const cls = class { };
      const config = ConfigManager.get('email-dev');

      DependencyRegistry.registerFactory({
        fn: () => new NodemailerTransport(config as any),
        target: MailTransport as any,
        src: cls,
        id: 'nodemailer',
      });

      DependencyRegistry.install(cls, { curr: cls, type: 'added' });
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
      const info = await (await this.getService()).sendCompiled(key.split('.tpl')[0].split('email/')[1], { to, context });
      console.log(`Sent email to ${to}`);
      return { status: 200, message: 'Successfully sent', content: { url: require('nodemailer').getTestMessageUrl(info) }, contentType: 'application/json' };
    } catch (e) {
      console.log(`Failed to send email to ${to}`);
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

if (!ConfigManager.get('email-dev')) {
  console.error('Please configure your email setup and/or credentials for testing. Under `email-dev` in your `dev.yml`');
  console.error('If you want a free service to send emails, use https://ethereal.email/');
  console.error('Email sending will not work until the above is fixed');
}
