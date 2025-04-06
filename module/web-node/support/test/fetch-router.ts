import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebFilterContext, WebResponse, WebRouter } from '@travetto/web';

/**
 * Support for invoking http requests against the server
 */
@Injectable()
export class NodeWeFetchRouter implements WebRouter {

  @Inject()
  config: WebConfig;

  async execute({ req }: WebFilterContext): Promise<WebResponse> {
    const { query, method, body, headers, path } = req;

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.entries(query).map<[string, string]>(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`]);
      q = `?${new URLSearchParams(pairs).toString()}`;
    }

    const finalPath = `${path}${q}`;

    const res = await fetch(`http://localhost:${this.config.port}${finalPath}`, { method, body, headers });

    const out = Buffer.from(await res.arrayBuffer());
    return WebResponse.from(out).with({ statusCode: res.status, headers: res.headers });
  }
}