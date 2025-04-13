import { AppError, ErrorCategory } from '@travetto/runtime';

import { WebHeaders } from './headers.ts';
import { WebMessage, WebMessageInit } from './message.ts';

export interface WebResponseInput<B> extends WebMessageInit<B> {
  statusCode?: number;
};

/**
 * Mapping from error category to standard http error codes
 */
const ERROR_CATEGORY_STATUS: Record<ErrorCategory, number> = {
  general: 500,
  notfound: 404,
  data: 400,
  permissions: 403,
  authentication: 401,
  timeout: 408,
  unavailable: 503,
};

/**
 * Web Response as a simple object
 */
export class WebResponse<B = unknown> implements WebMessage<B> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param statusCode Status code
    */
  static redirect(location: string, statusCode = 302): WebResponse<undefined> {
    return new WebResponse({ statusCode, headers: { Location: location } });
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

    const error: Error & { category?: ErrorCategory, status?: number, statusCode?: number } = body;
    const statusCode = error.status ?? error.statusCode ?? ERROR_CATEGORY_STATUS[error.category!] ?? 500;

    return new WebResponse({ body, statusCode });
  }

  statusCode?: number;
  body: B;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput<B>) {
    Object.assign(this, { cookies: [] }, o);
    this.headers = new WebHeaders(o.headers);
  }
}