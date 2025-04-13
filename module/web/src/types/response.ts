import { WebHeaders } from './headers.ts';
import { WebMessage, WebMessageInit } from './message.ts';

export interface WebResponseInput<B> extends WebMessageInit<B> {
  statusCode?: number;
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

  statusCode?: number;
  body: B;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput<B> = {}) {
    Object.assign(this, { cookies: [] }, o);
    this.headers = new WebHeaders(o.headers);
  }
}