import { Response, Request } from '../types';
import { MimeType } from './mime';

abstract class BaseResponse implements Partial<Response> {
  json(this: Response, val: any) {
    this.setHeader('Content-Type', MimeType.JSON);
    this.send(val);
  }
  get statusCode(this: Response): number {
    return this.status() as number;
  }
  set statusCode(this: Response, val: number) {
    this.status(val);
  }
  location(this: Response, path: string) {

    if (!this.statusCode) {
      this.status(302);
    }

    this.setHeader('Location', path);
  }
  redirect(this: Response & BaseResponse, code: number | string, path?: string) {
    if (!path) {
      path = code as any;
      code = 302;
    }
    this.status(code as number);
    this.location(path!);
    this.setHeader('Content-Length', '0');
    this.send('');
  }
}

abstract class BaseRequest implements Partial<Request> {
  header(this: Request, key: string) {
    return this.headers![key.toLowerCase()] as string;
  }
}

export class RestAppUtil {
  static decorateRequest<T extends Request>(req: Partial<T> & Record<string, any>): T {
    delete req.redirect;
    Object.setPrototypeOf(req, BaseRequest.prototype);
    req.url = req.path;
    (req as Record<string, any>).connection = {};
    return req as T;
  }

  static decorateResponse<T extends Response>(res: Partial<T> & Record<string, any>): T {
    Object.setPrototypeOf(res, BaseResponse.prototype);
    return res as T;
  }
}