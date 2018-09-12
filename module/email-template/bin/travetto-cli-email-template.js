//@ts-check
const http = require('http');
const path = require('path');
const URL = require('url');

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

    const { Watcher } = require('@travetto/base/src/watch');

    const watcher = new Watcher();
    watcher.add([{ testFile: x => x.endsWith('.html'), testDir: x => x.includes('assets') }]);
    watcher.on('all', ({ entry, event }) => {
      console.log(event, entry.file);

      if (entry.file.endsWith('.html')) {
        const file = entry.file.split('assets/')[1];
        // @ts-ignore
        delete engine.cache[file]
        engine.registerTemplateFile(entry.file, file);
        ts = Date.now();
      }
    });
    watcher.run();

    http.createServer(async (request, response) => {
      const url = URL.parse(`http://localhost:${port}${request.url}`);

      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      if (url.pathname === '/check') {
        sendJSON(response, { timestamp: ts });
      } else {
        const filename = url.pathname.substring(1).replace(/[.]txt$/, '.html');
        const ext = url.path.split('.').pop();

        switch (ext) {
          case 'jpg':
          case 'png':
          case 'gif':
            const img = await engine.getAssetBuffer(filename);
            sendImage(response, img, ext)
            break;
          case 'css':
            const css = await engine.getAssetBuffer(filename);
            sendCss(response, css);
            break;
          case 'txt':
            let { text } = await engine.getCompiled(filename);
            sendHtml(response, `<html><head></head><body><pre>${text}</pre></body></html>`);
            break;
          case 'html':
            let { html } = await engine.getCompiled(filename);
            sendHtml(response, html);
            break;
        }
      }
      response.end();
    }).listen(port);
  });
};