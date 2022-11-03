import { RestInterceptor, SerializeInterceptor, FilterContext } from '@travetto/rest';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements RestInterceptor {

  after = [SerializeInterceptor];

  intercept(ctx: FilterContext) {
    console.log('Hello world!');
  }
}