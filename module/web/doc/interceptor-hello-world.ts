import { HttpContext, HttpInterceptor, HttpInterceptorCategory } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'application';

  intercept(ctx: HttpContext) {
    console.log('Hello world!');
  }
}