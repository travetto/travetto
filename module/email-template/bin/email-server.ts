import * as http from 'http';
import * as url from 'url';
import * as Mustache from 'mustache';

import { DefaultMailTemplateEngine } from '../src/template';

const INDEX = require('fs').readFileSync(require('path').resolve(__dirname, 'index.html')).toString();

async function simpleWatcher(commonFolder: string, paths: string[], handler: {
  changed?(file: string): void;
  removed?(file: string): void;
  added?(file: string): void;
}) {
  const { Watcher } = await import('@travetto/base/src/watch');
  const watcher = new Watcher();

  watcher.add([{
    testFile: x => x.includes(commonFolder),
    testDir: x => {
      return !!paths.find(y => x.startsWith(y));
    }
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

function buildContext(reqUrl: url.URL, content: string) {

  const base: { [key: string]: any } = {};

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

  for (const k of Array.from(Object.keys(base))) {
    const v = base[k];
    if (['number', 'boolean', 'string', 'undefiend'].includes(typeof v)) {
      const [last, ...rest] = k.split('.').reverse();
      const first = rest.reverse();
      let sub = base;
      for (const el of first) {
        sub = (sub[el] = (sub[el] || {}));
      }
      if (!(last in sub)) {
        sub[last] = v;
      }
    }
  }

  return base;
}

async function resolve(engine: DefaultMailTemplateEngine, request: http.IncomingMessage) {

  const reqUrl = new url.URL(request.url!);
  const filename = reqUrl.pathname.substring(1);

  await engine['initTemplates']();

  if (!filename || filename === 'index.html') {
    return {
      content: Mustache.render(INDEX, {
        templates: Object.keys(engine['_templates']).sort()
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

export async function runServer(port: number) {
  const { DependencyRegistry } = await import('@travetto/di/src/registry');
  const { ResourceManager } = await import('@travetto/base/src/resource');
  const [config] = DependencyRegistry.getCandidateTypes(DefaultMailTemplateEngine);
  const engine = await DependencyRegistry.getInstance(config.target, config.qualifier);
  const { Env } = await import('@travetto/base/src/env');

  const watcher = await simpleWatcher('resources/email', ResourceManager.getPaths().map(x => x.replace(Env.cwd, '').replace(/^[\/\\]/, '')), {
    changed(file) {
      console.log('Updating file', file);

      if (file.endsWith('.html')) {
        engine['cache'] = {};
        engine['_templatesLoaded'] = false;
      }

      if (file.endsWith('.scss')) {
        delete engine['_compiledSass'];
      }
    }
  });

  // @ts-ignore
  require('@travetto/cli/src/http').Server({
    onChange(cb: () => void) {
      watcher.on('changed', () => {
        console.log('Something changed');
        cb();
      });
    },
    resolve: resolve.bind(null, engine)
  }, port, 1000);

  console.log(`Now running at https://localhost:${port}`);

  if (process.platform === 'darwin') {
    require('child_process').exec(`open http://localhost:${port}`);
  }
}