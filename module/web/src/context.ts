import { AsyncContextValue, AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';
import { AppError, castTo, Class, toConcrete } from '@travetto/runtime';

import { FilterContext, FilterNext, HttpRequest, HttpResponse } from './types.ts';

@Injectable()
export class WebContext {

  #active = new AsyncContextValue<FilterContext>(this);
  #byType = new Map<string, () => unknown>();

  @Inject()
  context: AsyncContext;

  get request(): HttpRequest {
    return this.#active.get()?.req!;
  }

  get response(): HttpResponse {
    return this.#active.get()?.res!;
  }

  postConstruct(): void {
    this.registerType(toConcrete<HttpRequest>(), () => this.request);
    this.registerType(toConcrete<HttpResponse>(), () => this.response);
  }

  withContext(ctx: FilterContext, next: FilterNext): Promise<unknown> {
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