import * as http from 'http';
import * as url from 'url';
import * as Mustache from 'mustache';

import { TemplateUtil, MapLite } from './util';
import { ImageUtil } from './image';

export class DevServerUtil {

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
    console.debug('Resolving', filename, ext);

    switch (ext) {
      case '.jpg':
      case '.png':
      case '.ico':
      case '.gif': return this.resolveImage(filename);
      case '.html': return this.resolveIndex();
      case '.tpl.html': {
        const format = (reqUrl.searchParams.get('format') || 'html').toLowerCase();
        const context = await (async () => JSON.parse(reqUrl.searchParams.get('jsonContext') || '{}'))().catch(e => ({}));
        return this.resolveTemplate(filename, format, context, reqUrl.searchParams);
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