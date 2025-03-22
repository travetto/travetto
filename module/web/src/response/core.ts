import { asFull } from '@travetto/runtime';

import { HttpResponse, WebInternal } from '../types.ts';

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
   * Add value to vary header, or create if not existing
   */
  vary(this: HttpResponse, value: string): void {
    const header = this.getHeader('vary');
    if (!header?.includes(value)) {
      this.setHeader('vary', header ? `${header}, ${value}` : value);
    }
  }

  /**
   * Trigger redirect
   */
  redirect(this: HttpResponse, path: string, statusCode?: number): void {
    this.statusCode = statusCode ?? this.statusCode ?? 302;
    this.setHeader('Location', path);
    this.setHeader('Content-Length', '0');
    this.end();
  }

  /**
   * End response immediately
   */
  end(this: HttpResponse): void {
    this[WebInternal].takeControlOfResponse?.();
    this[WebInternal].nodeEntity.flushHeaders();
  }
}
