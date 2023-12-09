import { ExtensionContext } from 'vscode';
import http from 'node:http';

import { TargetEvent } from './types';
import { Log } from './log';

export class IpcSupport {

  static readJSONRequest<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise<T>((res, rej) => {
      const body: Buffer[] = [];
      req.on('data', (chunk) => body.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      req.on('end', () => {
        try {
          res(JSON.parse(Buffer.concat(body).toString('utf8')));
        } catch (err) {
          rej(err);
        }
      });
      req.on('error', rej);
    });
  }

  #ctrl = new AbortController();
  #handler: (response: TargetEvent) => void | Promise<void>;
  #log = new Log('travetto.vscode.ipc');

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  async activate(ctx: ExtensionContext): Promise<void> {
    const server = new http.Server(async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      try {
        if (/post/i.test(req.method || '')) {
          const ev = await IpcSupport.readJSONRequest<TargetEvent>(req);
          this.#log.info('Received IPC event', ev);
          this.#handler(ev);

        }
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `${e}` }));
      }
    });
    await new Promise<void>(resolve => {
      server.listen(undefined, '0.0.0.0', () => {
        this.#ctrl.signal.addEventListener('onabort', () => {
          server.closeAllConnections();
          server.close();
        });
        const addr = server.address();
        if (addr && typeof addr !== 'string') {
          ctx.environmentVariableCollection.replace('TRV_CLI_IPC', `http://127.0.0.1:${addr.port}`);
        }
        resolve();
      });
    });
  }

  deactivate(): void {
    this.#ctrl.abort();
  }
}