import { ExtensionContext } from 'vscode';
import http from 'node:http';

import { Env } from '@travetto/runtime';

import { TargetEvent } from './types.ts';
import { Log } from './log.ts';

export class IpcSupport {

  static async readJSONRequest<T>(req: http.IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
          const event = await IpcSupport.readJSONRequest<TargetEvent>(req);
          this.#log.info('Received IPC event', event);
          this.#handler(event);
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `${error}` }));
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
          ctx.environmentVariableCollection.replace(Env.TRV_CLI_IPC.key, `http://127.0.0.1:${addr.port}`);
        }
        resolve();
      });
    });
  }

  deactivate(): void {
    this.#ctrl.abort();
  }
}