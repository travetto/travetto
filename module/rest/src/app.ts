import { RestInterceptor, ControllerConfig, Response, Request } from './types';
import { RestConfig } from './config';

export abstract class RestApp<T = any> {
  interceptors: RestInterceptor[] = [];

  abstract get raw(): T;
  abstract init(config: RestConfig): Promise<any>;
  abstract registerController(controller: ControllerConfig): Promise<any>;
  abstract unregisterController(controller: ControllerConfig): Promise<any>;
  abstract listen(config: RestConfig): void | Promise<void>;

  registerInterceptor(interceptor: RestInterceptor) {
    this.interceptors.push(interceptor);
  }

  async executeInterceptors(req: Request, res: Response, proceed?: (err?: any) => any) {
    try {
      for (const it of this.interceptors) {
        await it.intercept(req, res);
      }
      if (proceed) {
        proceed();
      }
    } catch (e) {
      if (proceed) {
        proceed(e);
      } else {
        throw e;
      }
    }
  }
}
