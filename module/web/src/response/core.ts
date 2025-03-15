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
   * Get the status code
   */
  // @ts-expect-error
  get statusCode(this: HttpResponse): number {
    return this.status()!;
  }
  /**
   * Set the status code
   */
  // @ts-expect-error
  set statusCode(this: HttpResponse, val: number) {
    this.status(val);
  }

  /**
   * Send the request to a new location, given a path
   */
  location(this: HttpResponse, path: string): void {
    if (!this.statusCode) {
      this.status(302);
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

  /**
   * Redirect application to a new path
   * @param code The HTTP code to send
   * @param path The new location for the request
   */
  redirect(this: HttpResponse, code: number, path: string): void;
  redirect(this: HttpResponse, path: string): void;
  redirect(this: HttpResponse, pathOrCode: number | string, path?: string): void {
    this.status(typeof pathOrCode === 'number' ? pathOrCode : 302);
    this.location(path ?? pathOrCode.toString());
    this.setHeader('Content-Length', '0');
    this.send('');
  }
}
