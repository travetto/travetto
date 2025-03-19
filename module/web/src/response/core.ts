import { asFull } from '@travetto/runtime';

import { HttpResponse } from '../types.ts';

/**
 * Base response object
 */
export class HttpResponseCore implements Partial<HttpResponse> {

  /**
   * Add base response as support for the provided
   */
  static create<T extends HttpResponse>(res: Partial<T>): T {
    Object.setPrototypeOf(res, HttpResponseCore.prototype);
    return asFull<T>(res);
  }

  /**
   * Send the request to a new location, given a path
   */
  location(this: HttpResponse, path: string): void {
    if (!this.statusCode) {
      this.statusCode = 302;
    }
    this.setHeader('Location', path);
  }

  /**
   * Add value to vary header, or create if not existing
   */
  vary(this: HttpResponse, value: string): void {
    const header = this.getHeader('vary');
    if (!header?.includes(value)) {
      this.setHeader('vary', header ? `${header}, ${value}` : value);
    }
  }
}
