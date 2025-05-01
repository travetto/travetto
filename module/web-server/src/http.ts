import http from 'node:http';
import https from 'node:https';

import { WebSslKeyPair } from './types.ts';

export class WebHttpUtil {

  /** Start an http server */
  static async startHttpServer(config: {
    port: number;
    bindAddress: string;
    sslKeys?: WebSslKeyPair;
    handler?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  }): Promise<http.Server> {
    const { reject, resolve, promise } = Promise.withResolvers<void>();
    const core = config.sslKeys ?
      https.createServer(config.sslKeys!, config.handler) :
      http.createServer(config.handler);

    const server = core.listen(config.port, config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);

    await promise;
    server.off('error', reject);

    return server;
  }
}