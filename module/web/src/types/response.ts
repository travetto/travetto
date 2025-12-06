import { BaseWebMessage } from './message.ts';

export interface WebResponseContext {
  httpStatusCode?: number;
  isPrivate?: boolean;
  cacheableAge?: number;
}

/**
 * Web Response as a simple object
 */
export class WebResponse<B = unknown> extends BaseWebMessage<B, WebResponseContext> {

  /**
   * Build the redirect
   * @param location Location to redirect to
   * @param statusCode Status code
   */
  static redirect(location: string, statusCode = 302): WebResponse<undefined> {
    return new WebResponse({ context: { httpStatusCode: statusCode }, headers: { Location: location } });
  }
}