import { HttpInterceptor, InterceptorGroup FilterContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  dependsOn = [InterceptorGroup.Application];

  intercept(ctx: FilterContext) {
    console.log('Hello world!');
  }
}