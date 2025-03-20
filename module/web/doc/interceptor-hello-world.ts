import { HttpInterceptor, ApplicationInterceptorGroup, FilterContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  dependsOn = [ApplicationInterceptorGroup];

  intercept(ctx: FilterContext) {
    console.log('Hello world!');
  }
}