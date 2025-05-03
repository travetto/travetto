import http from 'node:http';
import https from 'node:https';

import { WebHttpServerHandle, WebSslKeyPair } from './types.ts';

export class WebHttpUtil {

  /** Start an http server */
  static async startHttpServer(config: {
    port: number;
    bindAddress: string;
    sslKeys?: WebSslKeyPair;
    handler?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  }): Promise<WebHttpServerHandle & { server: http.Server }> {
    const { reject, resolve, promise } = Promise.withResolvers<void>();
    const target = config.sslKeys ?
      https.createServer(config.sslKeys!, config.handler) :
      http.createServer(config.handler);

    target.listen(config.port, config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);

    await promise;
    target.off('error', reject);

    return {
      kill: () => target.close(),
      wait: new Promise<void>(close => target.on('close', close)),
      server: target
    };
  }
}