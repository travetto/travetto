import { Response, Request } from '../types';
import { RequestCore } from './internal/request';
import { ResponseCore } from './internal/response';

/**
 * Rest server utilities
 */
export class RestServerUtil {
  /**
   * Add base request as support for the provided
   * @param req Inbound request
   */
  static decorateRequest<T extends Request>(req: Partial<T> & Record<string, unknown>): T {
    delete req.redirect;
    Object.setPrototypeOf(req, RequestCore.prototype);
    req.path ??= (req.url ?? '').split(/[#?]/g)[0].replace(/^[^/]/, (a) => `/${a}`);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    req.method = req.method?.toUpperCase() as 'GET';
    // @ts-expect-error
    req.connection = {};

    if (!('files' in req)) { req.files = undefined; }
    if (!('auth' in req)) { req.auth = undefined; }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return req as T;
  }

  /**
   * Add base response as support for the provided
   * @param req Outbound response
   */
  static decorateResponse<T extends Response>(res: Partial<T> & Record<string, unknown>): T {
    Object.setPrototypeOf(res, ResponseCore.prototype);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return res as T;
  }
}