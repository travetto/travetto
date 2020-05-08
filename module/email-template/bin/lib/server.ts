import * as http from 'http';
import * as url from 'url';
import * as Mustache from 'mustache';
import * as fs from 'fs';

import { FsUtil } from '@travetto/boot';
import { ResourceManager } from '@travetto/base';
import { FilePresenceManager } from '@travetto/watch';

import { TemplateUtil } from './util';
import { ImageUtil } from './image';

export class EmailServerApp {

  /**
   * Creates a simple web app for testing and viewing emails
   */
  static INDEX = fs.readFileSync(`${__dirname}/index.html`, 'utf-8');

  /**
   * Resolves listing
   */
  static async resolveIndex() {
    return {
      content: Mustache.render(this.INDEX, {
        templates: (await ResourceManager.findAllByPattern(/[.]html$/, 'email')).sort()
      }),
      contentType: 'text/html',
      static: true
    };
  }

  /**
   * Resolve template
   */
  static async resolveTemplate(filename: string, reqUrl: url.URL) {
    const key = filename.replace(/[.]txt$/, '.html');
    const { text: templateText } = await TemplateUtil.compile(key);
    const data = TemplateUtil.buildContext(reqUrl, templateText);
    const { text, html } = await TemplateUtil.compile(key);

    let content = html;

    if (filename.endsWith('.txt')) {
      content = `
<html>
<head></head>
<body style="background-color: #eee">
  <pre style="background-color: white; width: 80%; padding: 1em; margin: 1em auto;">${text}</pre>
</body>
</html>`;
    }

    return { content: Mustache.render(content, data), contentType: 'text/html' };
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
    const filename = reqUrl.pathname.substring(1);

    if (!filename || filename === 'index.html') {
      return this.resolveIndex();
    } else if (filename.endsWith('.txt') || filename.endsWith('.html')) {
      return this.resolveTemplate(filename, reqUrl);
    } else {
      return this.resolveImage(filename);
    }
  }

  /**
   * Process requests
   */
  static getHandler() {
    return {
      async onChange(cb: () => void) {
        const watcher = new FilePresenceManager({
          cwd: FsUtil.cwd,
          ext: /[.](html|txt|scss|css|png|jpg|gif)$/,
          rootPaths: ResourceManager.getRelativePaths(),
          listener: {
            changed(file) {
              console.log('Updating file', file);
              cb();
            }
          }
        });

        await watcher.init();
      },
      resolve: this.resolve.bind(this)
    };
  }
}