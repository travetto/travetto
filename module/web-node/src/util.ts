import type { IncomingMessage } from 'node:http';

import { castTo } from '@travetto/runtime';
import { WebRequest } from '@travetto/web';

export class NodeWebUtil {
  /**
   * Create a web request given a node IncomingMessage
   */
  static toWebRequest(req: IncomingMessage, params?: Record<string, unknown>): WebRequest {
    const secure = 'encrypted' in req.socket && !!req.socket.encrypted;
    const url = new URL(`http${secure ? 's' : ''}://${req.headers.host}${req.url}`);

    return new WebRequest({
      protocol: secure ? 'https' : 'http',
      method: castTo(req.method?.toUpperCase()),
      path: url.pathname!,
      query: Object.fromEntries(url.searchParams.entries()),
      params,
      headers: req.headers,
      inputStream: req,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort
    });
  }
}