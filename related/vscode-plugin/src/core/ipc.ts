import { ExtensionContext } from 'vscode';
import http from 'node:http';

import { BinaryUtil, Env, JSONUtil, type ByteArray } from '@travetto/runtime';

import { TargetEvent } from './types.ts';
import { Log } from './log.ts';

export class IpcSupport {

  static async readJSONRequest<T>(request: http.IncomingMessage): Promise<T> {
    const chunks: ByteArray[] = [];
    for await (const chunk of request) {
      chunks.push(BinaryUtil.readChunk(chunk));
    }
    return JSONUtil.parseSafe(BinaryUtil.combineByteArrays(chunks));
  }

  #controller = new AbortController();
  #handler: (response: TargetEvent) => void | Promise<void>;
  #log = new Log('travetto.vscode.ipc');

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  async activate(ctx: ExtensionContext): Promise<void> {
    const server = new http.Server(async (request, response) => {
      response.setHeader('Content-Type', 'application/json');
      try {
        if (/post/i.test(request.method || '')) {
          const event = await IpcSupport.readJSONRequest<TargetEvent>(request);
          this.#log.info('Received IPC event', event);
          await this.#handler(event);
        }
        response.statusCode = 200;
        response.end(JSONUtil.toUTF8({ ok: true }));
      } catch (error) {
        response.statusCode = 500;
        response.end(JSONUtil.toUTF8({ error: `${error}` }));
      }
    });
    await new Promise<void>(resolve => {
      server.listen(undefined, '0.0.0.0', () => {
        this.#controller.signal.addEventListener('onabort', () => {
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
    this.#controller.abort();
  }
}