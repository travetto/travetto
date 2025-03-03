import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { HttpResponse } from '../../types';
import { RestSymbols } from '../../symbols';

/**
 * Base response object
 */
export class ResponseCore implements Partial<HttpResponse> {
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
   * Redirect application to a new path
   * @param code The HTTP code to send
   * @param path The new location for the request
   */
  redirect(this: HttpResponse & ResponseCore, code: number, path: string): void;
  redirect(this: HttpResponse & ResponseCore, path: string): void;
  redirect(this: HttpResponse & ResponseCore, pathOrCode: number | string, path?: string): void {
    let code = 302;
    if (typeof pathOrCode === 'number') {
      code = pathOrCode;
    } else {
      path = pathOrCode;
    }
    this.status(code);
    this.location(path!);
    this.setHeader('Content-Length', '0');
    this.send('');
  }

  /**
   * Send a stream to the response and wait for completion
   */
  async sendStream(this: HttpResponse, data: Readable): Promise<void> {
    await pipeline(data, this[RestSymbols.NodeEntity], { end: false });
    this.end();
  }
}
