import { AsyncContextValue, AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';
import { AppError, castTo, Class, toConcrete } from '@travetto/runtime';

import { WebRequest } from './types/request.ts';

@Injectable()
export class WebContext {

  #active = new AsyncContextValue<WebRequest>(this);
  #byType = new Map<string, () => unknown>();

  @Inject()
  context: AsyncContext;

  get req(): WebRequest {
    return this.#active.get()!;
  }

  postConstruct(): void {
    this.registerType(toConcrete<WebRequest>(), () => this.req);
  }

  withContext<T>(req: WebRequest, next: () => Promise<T>): Promise<T> {
    return this.context.run(() => {
      this.#active.set(req);
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