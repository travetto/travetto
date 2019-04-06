import * as url from 'url';
import * as http from 'http';
import { launch } from './os';

export interface HttpHandler {
  onChange?(cb: () => void): void;
  resolve(message: http.IncomingMessage): Promise<{
    content: string | Buffer;
    contentType?: string;
    static?: boolean;
  }>;
}

export class Server {
  static CONTENT_TYPES: { [key: string]: string } = {
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    css: 'text/css',
    html: 'text/html',
    txt: 'text/plain',
    js: 'text/javascript',
    json: 'application/json'
  };

  static CHECK_SCRIPT = `<head>
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
    }, %RATE%);
  </script>
  `;

  private timestamp = Date.now();
  private handler: HttpHandler;
  private port: number;
  private open: boolean = true;
  private reloadRate: number = 500;

  constructor(config: {
    handler: HttpHandler,
    port: number,
    open?: boolean,
    reloadRate?: number
  }) {
    for (const k of Object.keys(config)) {
      (this as any)[k] = (config as any)[k];
    }
  }

  run() {
    if (this.handler.onChange) {
      this.handler.onChange(() => this.timestamp = Date.now());
    }

    http.createServer(async (request, response) => {
      request.url = `http://localhost:${this.port}${request.url}`;
      const reqUrl = new url.URL(request.url);
      const ext = reqUrl.pathname.split('.').pop();

      let contentType;
      let content;
      let isStatic = false;

      try {
        if (reqUrl.pathname === '/check') {
          content = { timestamp: this.timestamp };
          contentType = Server.CONTENT_TYPES.json;
        } else {
          const res = await this.handler.resolve(request);
          content = res.content;
          isStatic = !!res.static;

          if (res.contentType) {
            contentType = res.contentType;
          } else {
            contentType = Server.CONTENT_TYPES[ext!];
          }
        }

        if (contentType === Server.CONTENT_TYPES.json && typeof content !== 'string') {
          content = JSON.stringify(content);
        } else if (typeof content === 'string' && contentType === Server.CONTENT_TYPES.html && this.handler.onChange && !isStatic) {
          content = content.replace(/<head>/, Server.CHECK_SCRIPT).replace('%RATE%', `${this.reloadRate}`);
        }
      } catch (e) {
        console.error(e.message);
        content = new Error(e).stack;
        contentType = Server.CONTENT_TYPES.txt;
        response.statusCode = 503;
        response.statusMessage = e.message;
      }

      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      response.setHeader('Content-Type', contentType);
      response.write(content);
      response.end();
    }).listen(this.port);

    if (this.open) {
      const finalUrl = `http://localhost:${this.port}`;
      console.debug(`Now running at ${finalUrl}`);
      launch(finalUrl);
    }
  }
}