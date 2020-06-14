import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import * as http from 'http';

import { CliUtil } from './util';

const RESOURCES = path.resolve(__dirname, '..', 'resources');
const read = (p: string) => fs.readFileSync(path.resolve(RESOURCES, p), 'utf8');

/**
 * Handler for dealing with http requests
 */
export interface HttpHandler {
  onChange?(cb: () => void): void;
  resolve(message: http.IncomingMessage): Promise<{
    content?: string | Buffer;
    contentType?: string;
    statusCode?: number;
    message?: string;
    static?: boolean;
  }>;
}

/**
 * Simple Web Server for HTML based UIs
 */
export class WebServer {
  static CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    css: 'text/css',
    html: 'text/html',
    txt: 'text/plain',
    js: 'text/javascript',
    json: 'application/json'
  };

  static CHECK_SCRIPT = `<head><script>${read('check.js')}</script>`;

  private timestamp = Date.now();
  private handler: HttpHandler;
  private port: number;
  private open: boolean = true;
  private reloadRate: number = 500;

  constructor(config: {
    handler: HttpHandler;
    port: number;
    open?: boolean;
    reloadRate?: number;
  }) {
    Object.assign(this, config);
  }

  /**
   * Handle the request/response
   *
   * @param request
   * @param response
   */
  async handle(request: http.IncomingMessage, response: http.ServerResponse) {
    request.url = `http://localhost:${this.port}${request.url}`;
    const reqUrl = new url.URL(request.url);
    const ext = reqUrl.pathname.split('.').pop();

    let contentType;
    let content;
    let isStatic = false;

    try {
      if (reqUrl.pathname === '/check') { // Check to see if code changed
        content = { timestamp: this.timestamp };
        contentType = WebServer.CONTENT_TYPES.json;
      } else {
        const res = await this.handler.resolve(request);
        response.statusCode = res.statusCode || 200;
        content = res.content || '';
        isStatic = !!res.static;

        if (res.contentType) {
          contentType = res.contentType;
        } else {
          contentType = WebServer.CONTENT_TYPES[ext!];
        }

        if (res.message) {
          response.statusMessage = res.message;
        }
      }

      if (contentType === WebServer.CONTENT_TYPES.json && typeof content !== 'string') {
        content = JSON.stringify(content);
      } else if (typeof content === 'string' && contentType === WebServer.CONTENT_TYPES.html && this.handler.onChange && !isStatic) {
        content = content.replace(/<head>/, WebServer.CHECK_SCRIPT).replace('$RATE', `${this.reloadRate}`);
      }
    } catch (e) {
      console.error(e.message);
      content = new Error(e).stack;
      contentType = WebServer.CONTENT_TYPES.txt;
      response.statusCode = 503;
      response.statusMessage = 'Invalid server response';
    }

    response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.setHeader('Content-Type', contentType);
    response.write(content);
    response.end();
  }

  /**
   * Trigger code change
   */
  onChange() {
    this.timestamp = Date.now();
  }

  /**
   * Run the server
   */
  start() {
    if (this.handler.onChange) {
      this.handler.onChange(this.onChange.bind(this));
    }

    const server = http.createServer(this.handle.bind(this)).listen(this.port);

    if (this.open) {
      const finalUrl = `http://localhost:${this.port}`;
      console.debug(`Now running at ${finalUrl}`);
      CliUtil.launch(finalUrl);
    }

    return server;
  }
}