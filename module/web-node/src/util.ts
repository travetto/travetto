import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';

import { BinaryUtil, castTo } from '@travetto/runtime';
import { WebRequest, WebResponse } from '@travetto/web';

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
      body: req,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort
    });
  }

  /**
   * Send WebResponse to ServerResponse
   */
  static async respondToServerResponse(webRes: WebResponse, res: ServerResponse): Promise<void> {
    res.statusCode = webRes.statusCode ?? 200;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (BinaryUtil.isReadable(webRes.body)) {
      await pipeline(webRes.body, res);
    } else {
      res.write(webRes.body);
      res.end();
    }
  }
}