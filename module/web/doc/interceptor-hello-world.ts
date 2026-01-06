import type { WebChainedContext, WebInterceptor, WebInterceptorCategory, WebInterceptorContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'application';

  applies(context: WebInterceptorContext<unknown>): boolean {
    return context.endpoint.httpMethod === 'HEAD';
  }

  filter(ctx: WebChainedContext) {
    console.log('Hello world!');
    return ctx.next();
  }
}