import { Response, Request } from '../types';
import { MimeType } from './mime';

/**
 * Base resposne object
 */
abstract class BaseResponse implements Partial<Response> {
  /**
   * Produce JSON as the output
   */
  json(this: Response, val: any) {
    this.setHeader('Content-Type', MimeType.JSON);
    this.send(val);
  }
  /**
   * Get the status code
   */
  // @ts-ignore
  get statusCode(this: Response): number {
    return this.status!() as number;
  }
  /**
   * Set the status code
   */
  // @ts-ignore
  set statusCode(this: Response, val: number) {
    this.status(val);
  }

  /**
   * Send the request to a new location, given a path
   */
  location(this: Response, path: string) {

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
  redirect(this: Response & BaseResponse, code: number, path: string): void;
  redirect(this: Response & BaseResponse, path: string): void;
  redirect(this: Response & BaseResponse, pathOrCode: number | string, path?: string) {
    let code = 302;
    if (path) {
      code = pathOrCode as number;
    } else {
      path = pathOrCode as string;
    }
    this.status(code);
    this.location(path!);
    this.setHeader('Content-Length', '0');
    this.send('');
  }
}

/**
 * Base Request object
 */
abstract class BaseRequest implements Partial<Request> {
  /**
   * Get the outbound response header
   * @param key The header to get
   */
  header(this: Request, key: string) {
    return this.headers![key.toLowerCase()] as string;
  }
}

/**
 * Rest server utilities
 */
export class RestServerUtil {
  /**
   * Add base request as support for the provided
   * @param req Inbound request
   */
  static decorateRequest<T extends Request>(req: Partial<T> & Record<string, any>): T {
    delete req.redirect;
    Object.setPrototypeOf(req, BaseRequest.prototype);
    req.url = req.path;
    // @ts-ignore
    req.connection = {};
    return req as T;
  }

  /**
   * Add base response as support for the provided
   * @param req Outbound response
   */
  static decorateResponse<T extends Response>(res: Partial<T> & Record<string, any>): T {
    Object.setPrototypeOf(res, BaseResponse.prototype);
    return res as T;
  }
}