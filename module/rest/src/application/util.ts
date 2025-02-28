import { castTo, asFull } from '@travetto/runtime';

import { HttpResponse, HttpRequest } from '../types';
import { HttpRequestCore } from './internal/request';
import { ResponseCore } from './internal/response';

/**
 * Rest server utilities
 */
export class RestServerUtil {
  /**
   * Add base request as support for the provided
   * @param req Inbound request
   */
  static decorateRequest<T extends HttpRequest>(req: Partial<T> & Record<string, unknown> & { connection?: unknown }): T {
    delete req.redirect;
    Object.setPrototypeOf(req, HttpRequestCore.prototype);
    req.path ??= (req.url ?? '').split(/[#?]/g)[0].replace(/^[^/]/, (a) => `/${a}`);
    req.method = castTo(req.method?.toUpperCase());
    req.connection = {};
    return asFull<T>(req);
  }

  /**
   * Add base response as support for the provided
   * @param req Outbound response
   */
  static decorateResponse<T extends HttpResponse>(res: Partial<T> & Record<string, unknown>): T {
    Object.setPrototypeOf(res, ResponseCore.prototype);
    return asFull<T>(res);
  }
}