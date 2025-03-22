import { AsyncContextValue, AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';
import { AppError, castTo, Class, toConcrete } from '@travetto/runtime';

import { HttpContext, HttpRequest, HttpResponse, NextFunction } from './types.ts';

@Injectable()
export class WebContext {

  #active = new AsyncContextValue<HttpContext>(this);
  #byType = new Map<string, () => unknown>();

  @Inject()
  context: AsyncContext;

  get req(): HttpRequest {
    return this.#active.get()?.req!;
  }

  get res(): HttpResponse {
    return this.#active.get()?.res!;
  }

  postConstruct(): void {
    this.registerType(toConcrete<HttpRequest>(), () => this.req);
    this.registerType(toConcrete<HttpResponse>(), () => this.res);
  }

  withContext(ctx: HttpContext, next: NextFunction): Promise<unknown> {
    return this.context.run(() => {
      this.#active.set(ctx);
      return next();
    });
  }

  registerType<T>(cls: Class<T>, provider: () => T): void {
    this.#byType.set(cls.Ⲑid, provider);
  }

  getByType<T>(cls: Class<T>): () => T {
    const item = this.#byType.get(cls.Ⲑid);
    if (!item) {
      throw new AppError('Unknown type for web context');
    }
    return castTo(item);
  }
}