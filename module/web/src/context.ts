import { AsyncContextValue, type AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';
import { RuntimeError, castTo, type Class } from '@travetto/runtime';

import { WebRequest } from './types/request.ts';

/**
 * Shared Async Context, powering the @ContextParams
 */
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
    this.registerSource(WebRequest, () => this.#request.get());
  }

  withContext<T>(request: WebRequest, next: () => Promise<T>): Promise<T> {
    return this.context.run(() => {
      this.#request.set(request);
      return next();
    });
  }

  registerSource<T>(cls: Class<T>, provider: () => T): void {
    this.#byType.set(cls.Ⲑid, provider);
  }

  getSource<T>(cls: Class<T>): () => T {
    const item = this.#byType.get(cls.Ⲑid);
    if (!item) {
      throw new RuntimeError('Unknown type for web context');
    }
    return castTo(item);
  }

  getValue<T>(cls: Class<T>): T {
    return this.getSource(cls)();
  }
}