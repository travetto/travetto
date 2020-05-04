import * as http from 'http';
import * as url from 'url';
import * as Mustache from 'mustache';
import * as fs from 'fs';

import { DefaultMailTemplateEngine } from '../src/template';
import { ConfigUtil } from '@travetto/config/src/internal/util';

/**
 * Creates a simple web app for testing and viewing emails
 */

const INDEX = fs.readFileSync(`${__dirname}/index.html`, 'utf-8');

/**
 * Listen for file changes
 */
async function simpleWatcher(commonFolder: string, paths: string[], handler: {
  changed?(file: string): void;
  removed?(file: string): void;
  added?(file: string): void;
}) {
  const { Watcher } = await import('@travetto/base');
  const watcher = new Watcher();

  watcher.add([{
    testFile: x => x.includes(commonFolder),
    testDir: x => !!paths.find(y => x.startsWith(y))
  }]);
  if (handler.added) {
    watcher.on('added', e => handler.added!(e.file));
  }
  if (handler.changed) {
    watcher.on('changed', e => handler.changed!(e.file));
  }
  if (handler.removed) {
    watcher.on('removed', e => handler.removed!(e.file));
  }

  watcher.run();

  return watcher;
}

/**
 * Create email context via URL and template
 */
function buildContext(reqUrl: url.URL, content: string) {

  const base: Record<string, any> = {};

  content.replace(/[{]{2}\s*([A-Za-z0-9_.]+)\s*[}]{2}/g, (all, sub) => {
    if (!reqUrl.searchParams.has(sub) || reqUrl.searchParams.get(sub) === '') {
      base[sub] = all;
    } else {
      base[sub] = reqUrl.searchParams.get(sub);
    }
    return '';
  });

  if (reqUrl.searchParams.has('jsonContext')) {
    try {
      Object.assign(base, JSON.parse(reqUrl.searchParams.get('jsonContext')!));
    } catch (e) {
    }
  }

  return ConfigUtil.breakDownKeys(base);
}

/**
 * Resolve template into output
 */
async function resolve(engine: DefaultMailTemplateEngine, request: http.IncomingMessage) {

  const reqUrl = new url.URL(request.url!);
  const filename = reqUrl.pathname.substring(1);

  await engine['initTemplates']();

  if (!filename || filename === 'index.html') {
    return {
      content: Mustache.render(INDEX, {
        templates: Object.keys(engine['templates']).sort()
      }),
      contentType: 'text/html',
      static: true
    };
  }

  if (filename.endsWith('.txt') || filename.endsWith('.html')) {
    const key = filename.replace(/[.]txt$/, '.html');
    const { text: templateText } = await engine.getCompiled(key);
    const data = buildContext(reqUrl, templateText);
    const { text, html } = await engine.template(key, data);

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

    return { content, contentType: 'text/html' };
  } else {
    const content = await engine.getImage(filename);
    return { content };
  }
}

/**
 * Process requests
 */
export async function serverHandler() {
  const { DependencyRegistry } = await import('@travetto/di');
  const { ResourceManager } = await import('@travetto/base');
  const [config] = DependencyRegistry.getCandidateTypes(DefaultMailTemplateEngine);
  const engine = await DependencyRegistry.getInstance(config.target, config.qualifier);

  const watcher = await simpleWatcher('resources/email', ResourceManager.getRelativePaths(), {
    changed(file) {
      console.log('Updating file', file);

      if (file.endsWith('.html')) {
        engine['cache'] = {};
        engine['templatesLoaded'] = false;
      }

      if (file.endsWith('.scss')) {
        delete engine['compiledSass'];
      }
    }
  });

  return {
    onChange(cb: () => void) {
      watcher.on('changed', () => {
        console.log('Something changed');
        cb();
      });
    },
    resolve: resolve.bind(null, engine)
  };
}