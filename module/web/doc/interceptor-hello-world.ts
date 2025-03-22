import { HttpContext, HttpInterceptor, HttpInterceptorCategory } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'application';

  filter(ctx: HttpContext) {
    console.log('Hello world!');
    return ctx.next();
  }
}