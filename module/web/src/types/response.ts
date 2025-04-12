import { AppError } from '@travetto/runtime';

import { Cookie } from './cookie.ts';
import { WebHeaders } from './headers.ts';
import { NodeBinary, WebBodyUtil } from '../util/body.ts';
import { WebMessage, WebMessageInit } from './message.ts';

export interface WebResponseInput<B> extends WebMessageInit<B> {
  statusCode?: number;
  cookies?: Cookie[];
};

/**
 * Web Response as a simple object
 */
export class WebResponse<B = unknown> implements WebMessage<B> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): WebResponse<undefined> {
    return new WebResponse({
      body: undefined, statusCode: status, headers: { Location: location }
    });
  }

  /**
   * From catch value
   */
  static fromCatch(err: unknown): WebResponse<Error> {
    if (err instanceof WebResponse) {
      return err;
    }

    const body = err instanceof Error ? err :
      (!!err && typeof err === 'object' && ('message' in err && typeof err.message === 'string')) ?
        new AppError(err.message, { details: err }) :
        new AppError(`${err}`);

    return new WebResponse({ body });
  }

  /**
   * Create a web response from a body input
   */
  static from<T>(body: T, opts?: Omit<WebResponseInput<T>, 'body'>): WebResponse<T> {
    return new WebResponse<T>({ ...opts, body });
  }

  cookies: Cookie[];
  statusCode?: number;
  body: B;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput<B>) {
    this.statusCode ??= o.statusCode;
    this.cookies = o.cookies ?? [];
    this.body = o.body!;
    this.headers = new WebHeaders(o.headers);

    if (this.body instanceof Error) {
      this.statusCode ??= WebBodyUtil.getErrorStatus(this.body);
    }
    if (this.headers.has('Content-Range')) {
      this.statusCode = 206;
    }
  }
}