//@ts-check
const http = require('http');
const path = require('path');
const url = require('url');

// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');

function addScript(html) {
  return html.replace(/<head>/, `<head>
  <script>
    let last_ts = undefined;
    setInterval(() => {
      const now = Date.now();
      fetch('/check', { method: 'POST' }).then(res => {
        res.json().then(({timestamp}) => {
          if (last_ts === undefined) {
            last_ts = timestamp;
          } else if (last_ts !== timestamp) {
            location.reload();
          }
        });
      });
    }, 500);
  </script>
`);
}

/**
 * 
 * @param {http.ServerResponse} res 
 * @param {string|Buffer} content 
 * @param {string} type 
 */
function respond(res, content, type) {
  res.setHeader('Content-Type', type);
  res.write(content);
  res.end();
}

/**
 * 
 * @param {http.ServerResponse} res 
 * @param {string} html 
 */
function sendHtml(res, html) {
  respond(res, addScript(html), 'text/html');
}

/**
 * 
 * @param {http.ServerResponse} res 
 * @param {object} body 
 */

function sendJSON(res, body) {
  respond(res, JSON.stringify(body), 'application/json');
}

/**
 * 
 * @param {http.ServerResponse} res 
 * @param {Buffer} buffer
 * @param {string} type
 */
function sendImage(res, buffer, type) {
  respond(res, buffer, `image/${type}`);
}

/**
 * 
 * @param {http.ServerResponse} res 
 * @param {Buffer} buffer
 */
function sendCss(res, buffer) {
  respond(res, buffer, `text/css`);
}

function proxify(o, ns = '') {
  return new Proxy({}, {
    get(self, key) {
      if (typeof key === 'string') {
        if (key === 'toString') {
          let sub = ns.substring(0, ns.length - 1);
          console.log('Being called', sub);
          if (sub in o) {
            return () => o[sub];
          } else {
            return () => `{{${sub}}}`
          }
        }
        return proxify(o, `${ns}${key.toString()}.`);
      } else {
        return self[key];
      }
    }
  });
}

module.exports = function() {
  program.command('email-template').action(async (cmd) => {
    let ts = Date.now();
    let port = 3839;

    process.env.MAIL_TEMPLATE_ASSETROOTS = `${path.resolve(process.cwd(), 'e2e')}`;

    await require('@travetto/base/bin/bootstrap').run();
    const { DefaultMailTemplateEngine } = require('../src/template');
    const { DependencyRegistry } = require('@travetto/di/src/registry');
    const [config] = DependencyRegistry.getCandidateTypes(DefaultMailTemplateEngine);

    /** @type DefaultMailTemplateEngine */
    const engine = await DependencyRegistry.getInstance(config.target, config.qualifier);
    const mailConf = await DependencyRegistry.getInstance(require('../src/config').MailTemplateConfig);

    const { Watcher } = require('@travetto/base/src/watch');

    const watched = new Set();

    const assetRoots = mailConf.assetRoots.map(x => x.split(path.join(process.cwd(), ''))[1]).filter(x => !!x);

    const watcher = new Watcher();
    watcher.add([{ testFile: x => x.includes('assets'), testDir: x => !!assetRoots.find(y => x.startsWith(y)) }]);
    watcher.on('added', entry => {
      console.log('Added', entry.file);

      if (entry.file.endsWith('.html')) {
        const fileKey = entry.file;
        const file = fileKey.split('assets/')[1];
        engine.registerTemplateFile(fileKey, file);
        watched.add(fileKey);
      }
    });
    watcher.on('changed', entry => {
      console.log('Updated', entry.file);

      if (entry.file.endsWith('.html')) {
        // @ts-ignore
        engine.cache = {};
        // @ts-ignore
        delete engine._wrapper;
        for (const fileKey of watched) {
          const file = fileKey.split('assets/')[1];
          engine.registerTemplateFile(fileKey, file);
        }
      }

      if (entry.file.endsWith('.scss')) {
        // @ts-ignore
        delete engine._compiledSass;
      }

      ts = Date.now();
    });
    watcher.run();

    http.createServer(async (request, response) => {
      const reqUrl = new url.URL(`http://localhost:${port}${request.url}`);

      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      if (reqUrl.pathname === '/check') {
        sendJSON(response, { timestamp: ts });
      } else {
        const filename = reqUrl.pathname.substring(1);
        const ext = reqUrl.pathname.split('.').pop();
        let data = Array.from(reqUrl.searchParams.entries()).reduce((acc, [k, v]) => {
          acc[k] = v;
          return acc;
        }, {});

        let placeholder = proxify(data);

        switch (ext) {
          case 'jpg':
          case 'png':
          case 'gif':
            try {
              const img = await engine.getAssetBuffer(filename);
              sendImage(response, img, ext)
            } catch (e) {
              console.error('Bad request for', filename);
            }
            break;
          case 'css':
            try {
              const css = await engine.getAssetBuffer(filename);
              sendCss(response, css);
            } catch (e) {
              console.error('Bad request for', filename);
            }
            break;
          case 'txt':
            let { text } = await engine.template(filename.replace(/[.]txt$/, '.html'), placeholder);
            sendHtml(response, `<html><head></head><body><pre>${text}</pre></body></html>`);
            break;
          case 'html':
            let { html } = await engine.template(filename, placeholder);
            sendHtml(response, html);
            break;
        }
      }
      response.end();
    }).listen(port);
  });
};