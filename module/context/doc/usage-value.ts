import { AsyncContext, AsyncContextValue, WithAsyncContext } from '@travetto/context';
import { Inject } from '@travetto/di';

export class ContextValueService {

  @Inject()
  context: AsyncContext;

  #name = new AsyncContextValue<string>(this);

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.#name.set(name);
    await this.additionalOp('extra');
    await this.finalOp();
  }

  async additionalOp(additional: string) {
    const name = this.#name.get();
    this.#name.set(`${name} ${additional}`);
  }

  async finalOp() {
    const name = this.#name.get();
    // Use name
    return name;
  }
}