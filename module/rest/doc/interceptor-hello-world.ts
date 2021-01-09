import { RestInterceptor, SerializeInterceptor, Request, Response } from '@travetto/rest';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements RestInterceptor {

  after = [SerializeInterceptor];

  intercept(req: Request, res: Response) {
    console.log('Hello world!');
  }
}