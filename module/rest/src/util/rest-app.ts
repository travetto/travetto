import { Response, Request } from '../types';
import { MimeType } from './mime';

// TODO: Document
abstract class BaseResponse implements Partial<Response> {
  json(this: Response, val: any) {
    this.setHeader('Content-Type', MimeType.JSON);
    this.send(val);
  }
  // @ts-ignore
  get statusCode(this: Response): number {
    return this.status() as number;
  }
  // @ts-ignore
  set statusCode(this: Response, val: number) {
    this.status(val);
  }
  location(this: Response, path: string) {

    if (!this.statusCode) {
      this.status(302);
    }

    this.setHeader('Location', path);
  }
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

// TODO: Document
abstract class BaseRequest implements Partial<Request> {
  header(this: Request, key: string) {
    return this.headers![key.toLowerCase()] as string;
  }
}

// TODO: Document
export class RestAppUtil {
  static decorateRequest<T extends Request>(req: Partial<T> & Record<string, any>): T {
    delete req.redirect;
    Object.setPrototypeOf(req, BaseRequest.prototype);
    req.url = req.path;
    // @ts-ignore
    req.connection = {};
    return req as T;
  }

  static decorateResponse<T extends Response>(res: Partial<T> & Record<string, any>): T {
    Object.setPrototypeOf(res, BaseResponse.prototype);
    return res as T;
  }
}