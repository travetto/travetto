import { HttpContext, HttpInterceptor, InterceptorGroup } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  dependsOn = [InterceptorGroup.Application];

  intercept(ctx: HttpContext) {
    console.log('Hello world!');
  }
}