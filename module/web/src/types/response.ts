import { castTo, Util } from '@travetto/runtime';

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
    return err instanceof WebResponse ? err : new WebResponse({ body: Util.ensureError(err) });
  }

  /**
   * Create a web response from a body input
   */
  static from<T>(body: T, opts?: Omit<WebResponseInput<T>, 'body'>): WebResponse<T> {
    return new WebResponse<T>({ ...opts, body });
  }

  #cookies: Record<string, Cookie> = {};
  statusCode?: number;
  body: B;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput<B>) {
    this.statusCode ??= o.statusCode;
    this.#cookies = Object.fromEntries(o.cookies?.map(x => [x.name, x]) ?? []);
    this.body = castTo(o.body);
    this.headers = new WebHeaders(o.headers);

    if (this.body instanceof Error) {
      this.statusCode ??= WebBodyUtil.getErrorStatus(this.body);
    } else if (Buffer.isBuffer(this.body)) {
      this.headers.set('Content-Length', `${this.body.byteLength}`);
    }

    if (!this.headers.has('Content-Type')) {
      this.headers.set('Content-Type', WebBodyUtil.defaultContentType(o.body));
    }

    if (this.headers.has('Content-Range')) { // Force status code if content range specified
      this.statusCode = 206;
    }
  }

  /**
   * Store a cookie by name, will be handled by the CookieJar at send time
   */
  setCookie(cookie: Cookie): void {
    this.#cookies[cookie.name] = { ...cookie, maxAge: (cookie.value !== undefined) ? cookie.maxAge : -1 };
  }

  /**
   * Get all the registered cookies
   */
  getCookies(): Cookie[] {
    return Object.values(this.#cookies);
  }

  /**
   * Get a binary version
   */
  toBinary(): WebResponse<NodeBinary> {
    return new WebResponse({ cookies: this.getCookies(), statusCode: this.statusCode, ...WebBodyUtil.toBinaryMessage(this) });
  }
}