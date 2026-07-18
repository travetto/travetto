import http from 'node:http';

import type { ExtensionContext } from 'vscode';

import { type BinaryArray, BinaryUtil, CodecUtil, Env, JSONUtil } from '@travetto/runtime';

import { Log } from './log.ts';
import type { TargetEvent } from './types.ts';

export class IpcSupport {
  static async readJSONRequest<T>(request: http.IncomingMessage): Promise<T> {
    const chunks: BinaryArray[] = [];
    for await (const chunk of request) {
      chunks.push(CodecUtil.readChunk(chunk));
    }
    return JSONUtil.fromBinaryArray(BinaryUtil.combineBinaryArrays(chunks));
  }

  #controller = new AbortController();
  #handler: (response: TargetEvent) => void | Promise<void>;
  #log = new Log('travetto.vscode.ipc');

  constructor(handler: (response: TargetEvent) => void | Promise<void>) {
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
        this.#controller.signal.addEventListener('abort', () => {
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
