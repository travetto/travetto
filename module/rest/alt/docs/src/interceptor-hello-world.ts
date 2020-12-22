import { Injectable } from '@travetto/di';
import { RestInterceptor } from '../../../src/interceptor/types';
import { Request, Response } from '../../../src/types';
import { SerializeInterceptor } from '../../../src/interceptor/serialize';

@Injectable()
export class HelloWorldInterceptor implements RestInterceptor {

  after = [SerializeInterceptor];

  intercept(req: Request, res: Response) {
    console.log('Hello world!');
  }
}