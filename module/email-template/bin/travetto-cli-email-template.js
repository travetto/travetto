//@ts-check
const http = require('http');
const path = require('path');
const url = require('url');

// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');

/**
 * @typedef Handler
 * @property {Function} [changed]
 * @property {Function} [removed]
 * @property {Function} [added]
 */

/**
 * 
 * @param {String} commonFolder 
 * @param {String[]} paths 
 * @param {Handler} handler 
 */
function simpleWatcher(commonFolder, paths, handler) {
  const { Watcher } = require('@travetto/base/src/watch');
  const watcher = new Watcher();

  watcher.add([{
    testFile: x => x.includes(commonFolder),
    testDir: x => !!paths.find(y => x.startsWith(y))
  }]);

  ['added', 'changed', 'removed'].filter(x => handler[x])
    .forEach(x => watcher.on(x, entry => handler[x](entry.file)));

  watcher.run();

  return watcher;
}

module.exports = function() {
  // @ts-ignore
  program.command('email-template').action(async (cmd) => {
    process.env.MAIL_TEMPLATE_ASSETROOTS = `${path.resolve(process.cwd(), 'e2e')}`;

    // @ts-ignore
    await require('@travetto/base/bin/bootstrap').run();
    const { DefaultMailTemplateEngine } = require('../src/template');
    const { TemplateUtil } = require('../src/util');
    const { DependencyRegistry } = require('@travetto/di/src/registry');
    const [config] = DependencyRegistry.getCandidateTypes(DefaultMailTemplateEngine);

    /**
     * @type {DefaultMailTemplateEngine}
     */
    const engine = await DependencyRegistry.getInstance(config.target, config.qualifier);
    const mailConf = await DependencyRegistry.getInstance(require('../src/config').MailTemplateConfig);
    const assetRoots = mailConf.assetRoots.map(x => x.split(path.join(process.cwd(), ''))[1]).filter(x => !!x);

    const watched = new Set();
    const watcher = simpleWatcher('assets', assetRoots, {
      added(file) {
        console.log('Registering file', file);

        if (file.endsWith('.html')) {
          const subFile = file.split('assets/')[1];
          engine.registerTemplateFile(file, subFile);
        }
        watched.add(file);
      },
      removed: file => watched.delete(file),
      changed(file) {
        console.log('Updating file', file);

        if (file.endsWith('.html')) {
          // @ts-ignore
          engine.cache = {};
          // @ts-ignore
          delete engine._wrapper;
          // @ts-ignore
          for (const wFile of watched) {
            if (wFile.endsWith('.html')) {
              const subFile = wFile.split('assets/')[1];
              engine.registerTemplateFile(wFile, subFile);
            }
          }
        }

        if (file.endsWith('.scss')) {
          // @ts-ignore
          delete engine._compiledSass;
        }
      }
    });

    // @ts-ignore
    require('@travetto/cli/src/http').Server({
      onChange(cb) {
        watcher.on('change', cb);
      },
      /**
       * @param {http.IncomingMessage} request 
       */
      async resolve(request) {
        let reqUrl = new url.URL(request.url);
        const filename = reqUrl.pathname.substring(1);

        if (filename.endsWith('.txt') || filename.endsWith('.html')) {
          const data = Array.from(reqUrl.searchParams.entries()).reduce((acc, [k, v]) => {
            acc[k] = v;
            return acc;
          }, {});
          const placeholder = TemplateUtil.proxiedContext(data);
          const { text, html } = await engine.template(filename.replace(/[.]txt$/, '.html'), placeholder);
          let content = html;

          if (filename.endsWith('.txt')) {
            content = `<html><head></head><body><pre>${text}</pre></body></html>`;
          }

          return { content, contentType: 'text/html' };
        } else {
          const content = await engine.getAssetBuffer(filename);
          return { content };
        }
      }
    }, 3839);
  });
};