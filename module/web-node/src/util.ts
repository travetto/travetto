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
      body: WebRequest.markUnprocessed(req),
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort
    });
  }

  /**
   * Send WebResponse to ServerResponse
   */
  static async respondToServerResponse(webRes: WebResponse, res: ServerResponse): Promise<void> {
    const binaryRes = webRes.toBinary();
    res.statusCode = binaryRes.statusCode ?? 200;
    binaryRes.headers.forEach((v, k) => res.setHeader(k, v));

    if (BinaryUtil.isReadable(binaryRes.body)) {
      await pipeline(binaryRes.body, res);
    } else {
      res.write(binaryRes.body);
      res.end();
    }
  }
}