import { Injectable } from '@travetto/di';
import type { WebChainedContext, WebInterceptor, WebInterceptorCategory, WebInterceptorContext } from '@travetto/web';

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
