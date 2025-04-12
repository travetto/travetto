import { buffer } from 'node:stream/consumers';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebFilterContext, WebResponse, WebDispatcher } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { WebTestDispatchUtil } from '@travetto/web/support/test/dispatch-util.ts';

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
    const stream = req.getUnprocessedStream();
    const body: RequestInit['body'] = stream ? await buffer(stream) : castTo(req.body);

    const res = await fetch(`http://localhost:${this.config.port}${finalPath}`, { method, body, headers });

    return WebTestDispatchUtil.finalizeResponseBody(
      new WebResponse({
        body: await res.blob(),
        statusCode: res.status, headers: res.headers
      })
    );
  }
}