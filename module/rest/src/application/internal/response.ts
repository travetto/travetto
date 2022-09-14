import { Response } from '../../types';

/**
 * Base response object
 */
export class ResponseCore implements Partial<Response> {
  /**
   * Get the status code
   */
  // @ts-expect-error
  get statusCode(this: Response): number {
    return this.status()!;
  }
  /**
   * Set the status code
   */
  // @ts-expect-error
  set statusCode(this: Response, val: number) {
    this.status(val);
  }

  /**
   * Send the request to a new location, given a path
   */
  location(this: Response, path: string): void {

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
  redirect(this: Response & ResponseCore, code: number, path: string): void;
  redirect(this: Response & ResponseCore, path: string): void;
  redirect(this: Response & ResponseCore, pathOrCode: number | string, path?: string): void {
    let code = 302;
    if (path) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      code = pathOrCode as number;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      path = pathOrCode as string;
    }
    this.status(code);
    this.location(path!);
    this.setHeader('Content-Length', '0');
    this.send('');
  }
}
