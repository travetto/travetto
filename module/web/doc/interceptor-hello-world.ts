import { WebInterceptor, SerializeInterceptor, FilterContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements WebInterceptor {

  dependsOn = [SerializeInterceptor];

  intercept(ctx: FilterContext) {
    console.log('Hello world!');
  }
}