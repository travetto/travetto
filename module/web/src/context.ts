import { AsyncContextValue, AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';
import { AppError, castTo, Class, toConcrete } from '@travetto/runtime';

import { WebRequest } from './types/request.ts';
import { CookieJar } from './util/cookie.ts';

@Injectable()
export class WebAsyncContext {

  #active = new AsyncContextValue<WebRequest>(this);
  #cookie = new AsyncContextValue<CookieJar>(this);
  #byType = new Map<string, () => unknown>();

  @Inject()
  context: AsyncContext;

  get req(): WebRequest {
    return this.#active.get()!;
  }

  get cookies(): CookieJar {
    return this.#cookie.get()!;
  }

  set cookies(val: CookieJar) {
    this.#cookie.set(val);
  }

  postConstruct(): void {
    this.registerType(toConcrete<WebRequest>(), () => this.#active.get()!);
    this.registerType(CookieJar, () => this.#cookie.get());
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