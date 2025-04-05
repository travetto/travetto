import { WebChainedContext, WebInterceptor, WebInterceptorCategory } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'application';

  filter(ctx: WebChainedContext) {
    console.log('Hello world!');
    return ctx.next();
  }
}