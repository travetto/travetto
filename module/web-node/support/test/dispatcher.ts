import { buffer } from 'node:stream/consumers';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebFilterContext, WebResponse, WebDispatcher } from '@travetto/web';

/**
 * Support for invoking http requests against the server
 */
@Injectable()
export class FetchWebDispatcher implements WebDispatcher {

  @Inject()
  config: WebConfig;

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    const { query, method, headers, path } = req;

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.entries(query).map<[string, string]>(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`]);
      q = `?${new URLSearchParams(pairs).toString()}`;
    }

    const finalPath = `${path}${q}`;
    const stream = req.getUnprocessedBodyAsStream();
    const body = stream ? await buffer(stream) : req.body;

    const res = await fetch(`http://localhost:${this.config.port}${finalPath}`, { method, body, headers });

    const out = Buffer.from(await res.arrayBuffer());
    return WebResponse.from(out).with({ statusCode: res.status, headers: res.headers });
  }
}