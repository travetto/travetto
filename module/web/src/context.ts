import { AsyncContextValue, AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';
import { AppError, castTo, Class, toConcrete } from '@travetto/runtime';

import { WebRequest } from './types/request.ts';

@Injectable()
export class WebAsyncContext {

  #request = new AsyncContextValue<WebRequest>(this);
  #byType = new Map<string, () => unknown>();

  @Inject()
  context: AsyncContext;

  get request(): WebRequest {
    return this.#request.get()!;
  }

  postConstruct(): void {
    this.registerType(toConcrete<WebRequest>(), () => this.#request.get());
  }

  withContext<T>(request: WebRequest, next: () => Promise<T>): Promise<T> {
    return this.context.run(() => {
      this.#request.set(request);
      return next();
    });
  }

  registerType<T>(cls: Class<T>, provider: () => T): void {
    this.#byType.set(cls.Ⲑid, provider);
  }

  getterByType<T>(cls: Class<T>): () => T {
    const item = this.#byType.get(cls.Ⲑid);
    if (!item) {
      throw new AppError('Unknown type for web context');
    }
    return castTo(item);
  }

  getByType<T>(cls: Class<T>): T {
    return this.getterByType(cls)();
  }
}